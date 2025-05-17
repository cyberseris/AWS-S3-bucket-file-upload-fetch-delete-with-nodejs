
require('dotenv').config();
const express = require('express');
const mime = require('mime-types');
const multer = require('multer');
const {S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsCommand} = require('@aws-sdk/client-s3');
const {getSignedUrl} = require('@aws-sdk/s3-request-presigner');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

async function getObjectSignedUrl(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1小時有效
    return url;
}

//取得檔案列表 urls
app.get('/api/v1/s3/fileList', async(req, res) => {
    const prefix = req.query.prefix || '';

    try{
        const command = new ListObjectsCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Prefix: prefix,
            MaxKeys: 100
        });

        const data = await s3Client.send(command);
        const objects = data.Contents || [];

        const result = await Promise.all(objects.map(async (obj) => ({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
            files: await getObjectSignedUrl(obj.Key)
        })));

        res.status(200).json({
            success: true,
            signedUrl: result
        });
        return
    }catch(error){
        res.status(500).json({ 
            success: false, 
            message: '取得檔案列表失敗' 
        });
        return
    }    
})

//取得單一檔案 url
app.get('/api/v1/s3/file', async(req, res) => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.query.filename
        });
    
        const result = await getSignedUrl(s3Client, command);

        res.status(200).json({
            success: true,
            objects: result
        });
        return
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '取得檔案失敗' 
        });      
        return  
    }
})

//上傳檔案
app.post('/api/v1/s3/upload', upload.single('file'), async(req, res) => {
    if(!req.file){
        res.status(400).json({
            success: false,
            message: '沒有上傳檔案'
        });
        return
    }

    const fileBuffer = req.file.buffer; // 檔案二進位內容
    const originalName = req.file.originalname; // 原始檔名
    const contentType = mime.lookup(originalName) || 'application/octet-stream'; //檔案型別

    try {
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: originalName,
            Body: fileBuffer,
            ContentType: contentType
        });
    
        await s3Client.send(command);
 
        res.status(200).json({
            success: true,
            message: '檔案上傳成功',
            filename: originalName
        });
        return
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '檔案上傳失敗'
        });
        return        
    }
})

//刪除檔案
app.delete('/api/v1/s3/del', async (req, res) => {
    try{
        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.query.filename
        });   
    
        await s3Client.send(command);

        res.status(200).json({
            success: true,
            message: '檔案刪除成功'
        });
        return
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '檔案刪除失敗' 
        });
        return        
    }
})

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})