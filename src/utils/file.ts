/**
 * 文件处理工具函数
 */

/**
 * 读取文件为 ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 读取文件为 DataURL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * 下载文件
 */
export function downloadFile(dataURL: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * 验证字体文件类型
 */
export function isValidFontFile(file: File): boolean {
  const validTypes = [
    'font/ttf',
    'font/otf',
    'font/woff',
    'font/woff2',
    'application/font-sfnt',
    'application/font-woff',
  ]
  const validExtensions = ['.ttf', '.otf', '.woff', '.woff2']
  
  const isValidType = validTypes.includes(file.type)
  const isValidExtension = validExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  )
  
  return isValidType || isValidExtension
}

/**
 * 验证图片文件类型
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
  
  const isValidType = validTypes.includes(file.type)
  const isValidExtension = validExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  )
  
  return isValidType || isValidExtension
}