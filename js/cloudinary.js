// js/cloudinary.js

export const CLOUD_NAME = "dew69gkkw";
export const UPLOAD_PRESET = "school_uploads";

export const CLOUDINARY_URL =
`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

export async function uploadFile(file){

const formData = new FormData();

formData.append("file", file);
formData.append("upload_preset", UPLOAD_PRESET);

const res = await fetch(CLOUDINARY_URL,{
method:"POST",
body:formData
});

const data = await res.json();

return data.secure_url;

}