import { Platform } from "react-native";
import { File } from "expo-file-system";
import { fetch as nativeFetch } from "expo/fetch";

// Only one chunk is sent at a time; native files are never loaded into JS in full.
export async function sendVideoChunks(
  url: string,
  uri: string,
  chunkSize: number,
  onProgress?: (n: number) => void,
  resume = false,
) {
  if (
    !/^https:\/\/storage\.googleapis\.com\//.test(url) &&
    !/^https:\/\/www\.googleapis\.com\/upload\//.test(url)
  )
    throw new Error("Invalid upload destination");
  const file =
    Platform.OS === "web" ? await (await fetch(uri)).blob() : new File(uri);
  const size = file.size;
  let offset = 0;
  let failures = 0;
  const send = Platform.OS === "web" ? fetch : nativeFetch;
  if (resume) {
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await send(url,{method:'PUT',headers:{'Content-Range':`bytes */${size}`},body:new Uint8Array(0),signal:controller.signal});
      if(response.status===200||response.status===201){onProgress?.(100);return;}
      if(response.status!==308)throw new Error('Upload session unavailable. Select the video again.');
      const range=response.headers.get('Range');offset=range?Number(range.split('-')[1])+1:0;
    } finally {clearTimeout(timer);}
  }
  while (offset < size) {
    const end = Math.min(offset + chunkSize, size);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      let response: Response;
      try {
        response = await send(url, {
          method: "PUT",
          headers: { "Content-Range": `bytes ${offset}-${end - 1}/${size}` },
          body: file.slice(offset, end) as any,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (response.status === 200 || response.status === 201) {
        onProgress?.(100);
        return;
      }
      if (response.status !== 308) throw new Error("Upload interrupted");
      const range = response.headers.get("Range");
      if (!range)
        throw new Error(
          "Storage upload response is missing progress. Check bucket CORS.",
        );
      offset = Number(range.split("-")[1]) + 1;
      if(!Number.isFinite(offset)||offset<0||offset>size)throw new Error("Invalid upload progress");
      failures = 0;
      onProgress?.(Math.floor((offset / size) * 100));
    } catch (e) {
      if (++failures > 3)
        throw new Error(
          "Video upload interrupted. Check your connection and retry.",
        );
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const status = await send(url, {
          method: "PUT",
          headers: { "Content-Range": `bytes */${size}` },
          body: new Uint8Array(0),
          signal: controller.signal,
        });
        if (status.status === 200 || status.status === 201) {
          onProgress?.(100);
          return;
        }
        if (status.status !== 308) throw e;
        const range = status.headers.get("Range");
        offset = range ? Number(range.split("-")[1]) + 1 : 0;
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
