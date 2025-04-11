import {v2 as cloudinary} from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET, 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        const stats = fs.statSync(localFilePath);
        if (stats.size === 0) {
            console.error('File is empty');
            fs.unlinkSync(localFilePath);
            return null;
        }
        const response = await cloudinary.uploader.upload(localFilePath,  { resource_type: "auto",   timeout: 30000 });

        fs.unlinkSync(localFilePath);
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) 
        return null;
    }
} 

// delete an old image
const deleteFromCloudinary = async (OldFileLocalPath) => {
    try {
        const result = await cloudinary.uploader.destroy(OldFileLocalPath);
        console.log('Delete response:', result);
        return result;
    } catch (error) {
        console.error('Error deleting file:', error);
        throw error;
    }
};

export { uploadOnCloudinary , deleteFromCloudinary }