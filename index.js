import connectDB from './config/db_connect.js';
import dotenv from 'dotenv';
import app from './app.js';

// Load environment variables
dotenv.config({ path: '.env' });

const port = process.env.PORT || 80;

connectDB()
  .then(() => {
    app.on('error', (error) => {
      console.log('Error in app:', error);
    });

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is listening at port ${port}`);
    });
  })
  .catch((error) => {
    console.log('MongoDB connection failed. Error:', error);
});