class ApiError extends Error {
    constructor(statusCode, message, data = null) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.success = false;
        this.timestamp = new Date().toISOString(); // Add timestamp for errors
    }

    // Method to send error response
    send(res) {
        res.status(this.statusCode).json({
            success: this.success,
            message: this.message,
            data: this.data,
            timestamp: this.timestamp,
        });
    }
}

export { ApiError };
