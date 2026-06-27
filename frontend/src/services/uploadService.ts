import api from "./api";

export const uploadService = {
  uploadReceipt: async (file: File): Promise<{ filename: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/upload/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  },

  uploadDocument: async (file: File): Promise<{ filename: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/upload/document", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  }
};
