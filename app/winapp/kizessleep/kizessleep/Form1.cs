using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Windows.Forms;
using Newtonsoft.Json;

namespace kizessleep
{
    public partial class Form1 : Form
    {
        private string selectedFilePath;
        private readonly HttpClient client;
        private System.Windows.Forms.Timer pollTimer;
        private string currentProcessingId;
        private Button btnDownloadExcel;
        private Label lblStatus;

        public Form1()
        {
            InitializeComponent();
            client = new HttpClient();
            
            // Initialize status label
            lblStatus = new Label
            {
                AutoSize = true,
                Location = new Point(200, 75),
                Visible = false
            };
            this.Controls.Add(lblStatus);
            
            // Initialize the download button but don't show it yet
            btnDownloadExcel = new Button
            {
                Text = "Скачать Excel",
                Visible = true,
                Enabled = false,
                Location = new Point(93, 70),
                Size = new Size(100, 23)
            };
            btnDownloadExcel.Click += BtnDownloadExcel_Click;
            this.Controls.Add(btnDownloadExcel);
            
            // Initialize the timer
            pollTimer = new System.Windows.Forms.Timer
            {
                Interval = 10000 // 10 seconds
            };
            pollTimer.Tick += PollTimer_Tick;
        }

        private async void btnSelectFile_Click(object sender, EventArgs e)
        {
            using (OpenFileDialog openFileDialog = new OpenFileDialog())
            {
                openFileDialog.Filter = "EDF files (*.edf)|*.edf|All files (*.*)|*.*";
                openFileDialog.FilterIndex = 1;

                if (openFileDialog.ShowDialog() == DialogResult.OK)
                {
                    selectedFilePath = openFileDialog.FileName;
                    txtFilePath.Text = selectedFilePath;
                }
            }
        }

        private async void btnUpload_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrEmpty(selectedFilePath))
            {
                MessageBox.Show("Пожалуйста, сначала выберите файл.", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            btnUpload.Enabled = false;
            lblStatus.Text = "Загрузка...";
            lblStatus.Visible = true;

            try
            {
                using (var formData = new MultipartFormDataContent())
                {
                    var fileContent = new ByteArrayContent(File.ReadAllBytes(selectedFilePath));
                    formData.Add(fileContent, "file", Path.GetFileName(selectedFilePath));

                    var response = await client.PostAsync(txtServerUrl.Text, formData);
                    var responseText = await response.Content.ReadAsStringAsync();

                    var jsonResponse = JsonConvert.DeserializeObject<JsonResponse>(responseText);
                    
                    if (jsonResponse.success)
                    {
                        LinkLabel responseLabel = new LinkLabel();
                        responseLabel.Parent = this;
                        responseLabel.AutoSize = true;
                        responseLabel.Location = txtResponse.Location;
                        
                        string baseText = $"Запущена обработка файла {jsonResponse.responseObject.filename} под ID {jsonResponse.responseObject.uid}\r\n";
                        string linkText = $"https://sleep.flint3s.ru/#/processing/{jsonResponse.responseObject.uid}";
                        string fullText = baseText + "Следить за состоянием обработки можно также на " + linkText;
                        
                        responseLabel.Text = fullText;
                        
                        int linkStart = fullText.IndexOf(linkText);
                        responseLabel.Links.Add(linkStart, linkText.Length, linkText);
                        
                        responseLabel.LinkColor = Color.Blue;
                        responseLabel.VisitedLinkColor = Color.Purple;
                        responseLabel.LinkBehavior = LinkBehavior.HoverUnderline;
                        
                        responseLabel.LinkClicked += (s, ev) => {
                            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = ev.Link.LinkData.ToString(),
                                UseShellExecute = true
                            });
                        };

                        if (txtResponse != null)
                        {
                            this.Controls.Remove(txtResponse);
                        }
                        txtResponse = null;

                        lblStatus.Text = "Файл загружен. Ожидание обработки...";
                        btnDownloadExcel.Visible = true;
                        btnDownloadExcel.Enabled = false;

                        // Start polling
                        currentProcessingId = jsonResponse.responseObject.uid;
                        pollTimer.Start();
                    }
                    else
                    {
                        Label errorLabel = new Label();
                        errorLabel.Parent = this;
                        errorLabel.AutoSize = true;
                        errorLabel.Location = txtResponse.Location;
                        errorLabel.Text = responseText;
                        
                        if (txtResponse != null)
                        {
                            this.Controls.Remove(txtResponse);
                        }
                        txtResponse = null;
                    }
                }
            }
            catch (Exception ex)
            {
                Label errorLabel = new Label();
                errorLabel.Parent = this;
                errorLabel.AutoSize = true;
                errorLabel.Location = txtResponse.Location;
                errorLabel.Text = $"Ошибка: {ex.Message}";
                
                if (txtResponse != null)
                {
                    this.Controls.Remove(txtResponse);
                }
                txtResponse = null;
            }
            finally
            {
                btnUpload.Enabled = true;
            }
        }

        private async void PollTimer_Tick(object sender, EventArgs e)
        {
            try
            {
                var response = await client.GetAsync($"{txtServerUrl.Text.Replace("/upload", "")}/export/{currentProcessingId}");
                
                if (response.StatusCode == System.Net.HttpStatusCode.OK)
                {
                    pollTimer.Stop();
                    lblStatus.Text = "Обработка завершена. Файл Excel готов к скачиванию";
                    btnDownloadExcel.Enabled = true;
                }
                else if (response.StatusCode != System.Net.HttpStatusCode.NotFound)
                {
                    pollTimer.Stop();
                    lblStatus.Text = "Ошибка при проверке статуса обработки";
                    MessageBox.Show("Произошла ошибка при проверке статуса обработки", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                pollTimer.Stop();
                lblStatus.Text = "Ошибка при проверке статуса";
                MessageBox.Show($"Ошибка при проверке статуса: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private async void BtnDownloadExcel_Click(object sender, EventArgs e)
        {
            try
            {
                var response = await client.GetAsync($"{txtServerUrl.Text.Replace("/upload", "")}/export/{currentProcessingId}");
                
                if (response.IsSuccessStatusCode)
                {
                    using (SaveFileDialog saveFileDialog = new SaveFileDialog())
                    {
                        saveFileDialog.Filter = "Excel files (*.xlsx)|*.xlsx";
                        saveFileDialog.FileName = $"report_{currentProcessingId}.xlsx";

                        if (saveFileDialog.ShowDialog() == DialogResult.OK)
                        {
                            var fileBytes = await response.Content.ReadAsByteArrayAsync();
                            File.WriteAllBytes(saveFileDialog.FileName, fileBytes);
                            MessageBox.Show("Файл успешно сохранен", "Успех", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка при скачивании файла: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    class JsonResponse
    {
        public bool success { get; set; }
        public string message { get; set; }
        public ResponseObject responseObject { get; set; }
        public int statusCode { get; set; }
    }

    class ResponseObject
    {
        public string uid { get; set; }
        public string filename { get; set; }
        public string _id { get; set; }
        // Add other properties as needed
    }
}
