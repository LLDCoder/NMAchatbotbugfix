import { createBrowserHistory } from 'history';

const publicBase =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || "/";
const basename = publicBase === "/" ? undefined : publicBase.replace(/\/+$/, "");

export const history = createBrowserHistory({ basename });


export const urlParsing = (str:string) => {
  const str1:string = str.split('?')[1];
  const arr:string[] = str1.split('&');
  const data:any = {}
  arr.forEach((item) => {
    const itemarr:string[] = item.split('=')
    data[itemarr[0]] = itemarr[1]
  })
  return data;
}
