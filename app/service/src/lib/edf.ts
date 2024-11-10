interface Channel {
    label: string;
    data: number[];
    transducer: string;
    dimensions: string;
    phys_min: number;
    phys_max: number;
    digital_min: number;
    digital_max: number;
    prefilters: string;
    num_samples: number;
    k: number;
}

function arrayToAscii(array: Uint8Array, start: number, length: number): string {
    let str = "";
    for (let i = 0; i < length; i++) {
        str += String.fromCharCode(array[start + i]);
    }
    return str.trim();
}

function flipBits(n: number): number {
    return parseInt(n.toString(2).split('').map(bit => 1 - parseInt(bit)).join(''), 2);
}

export class EDF {
    private bytes: Uint8Array;
    private header: string;
    private patient: string;
    private info: string;
    private date: string;
    private time: string;
    private header_bytes: string;
    private data_format: string;
    private data_records: number;
    data_record_duration: number;
    private channelCount: number;
    duration: number;
    private bytes_per_sample: number;
    private has_annotations: boolean;
    channels: Channel[];
    private realChannelCount: number;
    private annotation_bytes: number;
    private sampling_rate: number;
    private sample_size: number;
    private headerOffset: number;
    private samples_in_one_data_record: number;
    private maxSample?: number;

    constructor(uint8array: Uint8Array) {
        let pos = 0;
        const buf = uint8array;
        this.bytes = uint8array;
        
        this.header = arrayToAscii(buf, pos, 8); pos += 8;
        this.patient = arrayToAscii(buf, pos, 80); pos += 80;
        this.info = arrayToAscii(buf, pos, 80); pos += 80;
        this.date = arrayToAscii(buf, pos, 8); pos += 8;
        this.time = arrayToAscii(buf, pos, 8); pos += 8;
        this.header_bytes = arrayToAscii(buf, pos, 8); pos += 8;
        this.data_format = arrayToAscii(buf, pos, 44); pos += 44;
        this.data_records = parseInt(arrayToAscii(buf, pos, 8)); pos += 8;
        this.data_record_duration = parseFloat(arrayToAscii(buf, pos, 8)); pos += 8;
        this.channelCount = parseInt(arrayToAscii(buf, pos, 4)); pos += 4;
        
        this.duration = this.data_record_duration*this.data_records;
        this.bytes_per_sample = this.header == "0" ? 2 : 3;
        this.has_annotations = false;
        
        var n = this.channelCount;
        
        
        
        this.channels = [];
        for (var i = 0; i<n; i++)
        {
            var channel = {} as Channel;
            channel.label = arrayToAscii(buf, pos, 16); pos += 16;
            channel.data = [];
            
            console.log("CHANNEL", i, channel.label);
            if (channel.label.indexOf("DF Annotations")>0)
            {
                this.has_annotations = true;
                
            }
            this.channels.push(channel);
        }
        
        console.log("CHANNELS", n);
        
        this.realChannelCount = n;
        if (this.has_annotations)
        {
            this.realChannelCount --;
        }		
        
        this.annotation_bytes = 0;
        
        console.log("REAL CHANNELS", this.realChannelCount);
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].transducer = arrayToAscii(buf, pos, 80); pos += 80;
        }
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].dimensions = arrayToAscii(buf, pos, 8); pos += 8;
        }
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].phys_min = parseInt(arrayToAscii(buf, pos, 8)); pos += 8;
        }
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].phys_max = parseInt(arrayToAscii(buf, pos, 8)); pos += 8;
        }
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].digital_min = parseInt(arrayToAscii(buf, pos, 8)); pos += 8;
        }
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].digital_max = parseInt(arrayToAscii(buf, pos, 8)); pos += 8;
        }
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].prefilters = arrayToAscii(buf, pos, 80); pos += 80;
        }
        
        for (var i = 0; i<n; i++)
        {
            this.channels[i].num_samples = parseInt(arrayToAscii(buf, pos, 8)); pos += 8;
            if (this.has_annotations && i == this.realChannelCount)
            {
                this.annotation_bytes = this.channels[i].num_samples*2;
            }
        }
        
        for (var i = 0; i<n; i++)
        {
            /*edf["channels"][i].reserved = arrayToAscii(buf, pos, 32);*/ 
            this.channels[i].k = (this.channels[i].phys_max - this.channels[i].phys_min)/(this.channels[i].digital_max - this.channels[i].digital_min);
            console.log("F for", i, this.channels[i].k);
            pos += 32; 
        }
        
        
        this.sampling_rate = this.channels[0].num_samples*this.data_record_duration;		
        this.sample_size = 0;		
        
        console.log("ANN BYTES", this.annotation_bytes);
        
        if (this.has_annotations)
        {
            this.sample_size = (n-1)*2*this.sampling_rate + 60*2;
        }
        else
        {
            this.sample_size = (n)*2*this.sampling_rate;
        }
        
        var duration = (buf.length - pos)/this.sample_size;		
        
        this.headerOffset = pos;
                
        this.samples_in_one_data_record = this.sampling_rate*this.data_record_duration;
    
                       
        for (var j = 0; j<this.data_records; j++)
        {
            for (var i = 0; i<this.realChannelCount; i++)
            {	
                var koef = this.channels[i].k;
                
                
                for (var k = 0; k<this.samples_in_one_data_record; k++)
                {					
                    if (this.bytes_per_sample == 2)
                    {
                        var b1 = buf[pos]; pos++;
                        var b2 = buf[pos]; pos++;						
                                               
                        var val = (b2 << 8) + b1;
            
                        if (b2 >> 7 == 1)
                        {				
                            val = -flipBits(val)-1;	
                        }
                        this.channels[i].data.push(val*koef);
                    }
                    else if (this.bytes_per_sample == 3)
                    {
                        var b1 = buf[pos]; pos++;
                        var b2 = buf[pos]; pos++;						
                        var b3 = buf[pos]; pos++;						
                                               
                        var val = (b3 << 16) + (b2 << 8) + b1;
            
                        if (b3 >> 7 == 1)
                        {				
                            val = -flipBits(val)-1;	
                        }
                        this.channels[i].data.push(val*koef);
                    }
                }
            }
            
            if (this.has_annotations)
            {
                var ann = arrayToAscii(buf, pos, this.annotation_bytes); pos+=this.annotation_bytes;
            }
        }
        
    }
    
    readSingleChannel(channel: number, startSecond: number, lengthSeconds: number): number[] {
        const startSample = startSecond * this.sampling_rate;
        let endSample = startSample + lengthSeconds * this.sampling_rate;
        
        if (this.maxSample && endSample > this.maxSample) {
            endSample = this.maxSample;
        }
        
        const data: number[] = [];
        const ch = this.channels[channel].data;
        
        for (let i = startSample; i < endSample; i++) {
            data.push(ch[i]);
        }
        
        return data;
    }
    
    
    read(startSecond: number, lengthSeconds: number): number[][] {
        const array: number[][] = [];
        
        console.log(this.realChannelCount, "REAL");
        
        for (let i = 0; i < this.realChannelCount; i++) {
            array.push(this.readSingleChannel(i, startSecond, lengthSeconds));
        }
        
        return array;
    }
    
    
}