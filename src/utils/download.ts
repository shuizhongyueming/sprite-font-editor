/**
 * 下载相关工具函数
 */

/**
 * 触发文件下载
 */
export function triggerDownload(dataURL: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Canvas 导出为 PNG
 */
export function exportCanvasToPNG(canvas: HTMLCanvasElement, filename: string = 'sprite-font.png'): void {
  try {
    const dataURL = canvas.toDataURL('image/png')
    triggerDownload(dataURL, filename)
  } catch (error) {
    console.error('Failed to export canvas:', error)
    throw new Error('导出失败，请检查 Canvas 状态')
  }
}

/**
 * Canvas 导出为 JPEG
 */
export function exportCanvasToJPEG(canvas: HTMLCanvasElement, quality: number = 0.9, filename: string = 'sprite-font.jpg'): void {
  try {
    const dataURL = canvas.toDataURL('image/jpeg', quality)
    triggerDownload(dataURL, filename)
  } catch (error) {
    console.error('Failed to export canvas:', error)
    throw new Error('导出失败，请检查 Canvas 状态')
  }
}

/**
 * 将 Blob 转换为 DataURL
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * 将 DataURL 转换为 Blob
 */
export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const binary = atob(parts[1])
  const array = new Uint8Array(binary.length)
  
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  
  return new Blob([array], { type: mime })
}