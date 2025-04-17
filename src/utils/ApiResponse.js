class ApiResponse {
    constructor(statusCode, data, message = "Success", requestId = null){
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode >= 200 && statusCode < 400;
        this.timestamp = new Date().toISOString(); 
    }
}

export { ApiResponse };
