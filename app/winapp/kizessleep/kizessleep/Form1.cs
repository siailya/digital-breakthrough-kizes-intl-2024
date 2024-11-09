using System;
using System.IO;
using System.Net.Http;
using System.Windows.Forms;

namespace kizessleep
{
    public partial class Form1 : Form
    {
        private string selectedFilePath;
        private readonly HttpClient client;

        public Form1()
        {
            InitializeComponent();
            client = new HttpClient();
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
            txtResponse.Text = "Загрузка...";

            try
            {
                using (var formData = new MultipartFormDataContent())
                {
                    var fileContent = new ByteArrayContent(File.ReadAllBytes(selectedFilePath));
                    formData.Add(fileContent, "file", Path.GetFileName(selectedFilePath));

                    var response = await client.PostAsync(txtServerUrl.Text, formData);
                    Console.WriteLine(response);
                    var responseText = await response.Content.ReadAsStringAsync();


                    txtResponse.Text = responseText;
                }
            }
            catch (Exception ex)
            {
                txtResponse.Text = $"Ошибка: {ex.Message}";
            }
            finally
            {
                btnUpload.Enabled = true;
            }
        }
    }
}
