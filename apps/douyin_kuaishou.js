import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import plugin from '../../../lib/plugins/plugin.js'; // 确认路径并调整

const card = true;

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VideoParser extends plugin {
  constructor() {
    super({
      name: '视频解析类',
      dsc: '解析视频链接并返回视频',
      event: 'message',
      priority: 14,
      rule: [
        {
          reg: 'https://(?:www\\.)?(?:v\\.)?(douyin|kuaishou)\\.com/\\w+/?',
          fnc: 'parseVideo'
        }
      ]
    });
  }

  async parseVideo(e) {
    const videoUrl = `http://api.yujn.cn/api/dspjx.php?url=${encodeURIComponent(e.msg)}`;
    const response = await fetch(videoUrl);
    const data = await response.json();

    if (!data || !data.data) {
      await e.reply("解析失败，请检查链接是否有效。");
      return;
    }

    if (data.data.video) {
      const videoResponse = await fetch(data.data.video);
      if (!videoResponse.ok) {
        await e.reply("下载视频失败，请稍后再试。");
        return;
      }

      const videoFileName = `video_${Date.now()}.mp4`;
      const videoFilePath = path.resolve('/root/Karin/data/karin-plugin-xl', videoFileName);

      // Ensure the data directory exists
      if (!fs.existsSync('/root/Karin/data/karin-plugin-xl')) {
        fs.mkdirSync('/root/Karin/data/karin-plugin-xl', { recursive: true });
      }

      const writer = fs.createWriteStream(videoFilePath);
      videoResponse.body.pipe(writer);

      writer.on('finish', async () => {
        let retryCount = 0;
        const maxRetries = 3;

        const sendVideo = async () => {
          try {
            console.log(`Sending video: file://${videoFilePath}`); // 添加日志
            await e.reply({ type: 'video', file: `file://${videoFilePath}` }); // 确认使用文件路径发送
          } catch (error) {
            console.error(`回复消息失败: ${error}`);
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`重试发送视频，第 ${retryCount} 次`);
              await sendVideo();
            } else {
              e.reply("视频文件下载成功，但发送失败，请稍后再试。");
            }
          }
        };

        await sendVideo();
      });

      writer.on('error', (err) => {
        console.error(`文件写入失败: ${err}`);
        e.reply("视频文件下载成功，但发送失败，请稍后再试。");
      });
    } else if (data.data.img) {
      // 去除重复的图片链接
      const uniqueImages = Array.from(new Set(data.data.img));
      const forwardMsg = uniqueImages.map(img => segment.image(img));

      await e.reply(await common.makeForwardMsg(e, forwardMsg));
    } else {
      await e.reply("解析失败，请检查链接是否有效。");
    }
  }
}