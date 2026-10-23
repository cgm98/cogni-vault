export const ExportService = {
  async exportVault(areaId?: string) {
    const url = areaId ? `/api/vault/export?areaId=${areaId}` : '/api/vault/export';
    window.open(url, '_blank');
  },
  async triggerNotesZipDownload(areaId?: string, _areaName?: string) {
    return this.exportVault(areaId);
  },
  async downloadObsidianZip(areaId?: string) {
    return this.exportVault(areaId);
  },
  async importVault(file: File) {
    const res = await fetch('/api/vault/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: file
    });
    return res.json();
  },
  async uploadObsidianZip(file: File) {
    return this.importVault(file);
  }
};
