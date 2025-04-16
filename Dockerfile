# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json if available
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose the port the app runs on (adjust if your app uses a different port)
EXPOSE 80

# Start the app
CMD ["npm", "run", "dev"]
