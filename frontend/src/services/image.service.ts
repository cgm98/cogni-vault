export const ImageService = {
  async upload(file: File): Promise<{ url: string }> {
    const filename = `${Date.now()}_${file.name}`;
    await fetch(`/api/images/${filename}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/png' },
      body: file
    });
    return { url: `/api/images/${filename}` };
  }
};
