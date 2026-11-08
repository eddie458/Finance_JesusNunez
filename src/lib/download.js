// Hands the browser a file to save. The link's URL is revoked a moment later, once the download has started.
export function saveFile(filename, parts, type) {
  const url=URL.createObjectURL(new Blob(parts,{type})); const link=document.createElement('a')
  link.href=url; link.download=filename; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}
