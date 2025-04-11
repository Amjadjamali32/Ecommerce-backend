import connectDB from './config/db_connect.js';
import dotenv from "dotenv";
import app from "./app.js";

dotenv.config({
    path: '.env'
});

const port = process.env.PORT || 5000;

connectDB()
.then(()=> {
    app.on("error" , (error)=> {
        log("Error in app: " , error);
    })
    app.listen(port, ()=> {
        console.log(`Server is listening at ${port}`);
    });
})
.catch((error)=> {
    console.log("MongoDB connection failed error: " , error);
})