export const downFile = (url:string, fileType:string) => {
  // window.open(url)
  const ele = document.createElement('a');
  ele.href = url;
  ele.download = fileType
  ele.style.display = "none"; 
  document.body.appendChild(ele)
  ele.click()
  document.body.removeChild(ele);
}