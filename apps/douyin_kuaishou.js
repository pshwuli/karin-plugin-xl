import plugin from "../../../lib/plugins/plugin.js";
import common from '../../../lib/common/common.js';
import fetch from "node-fetch";
import { segment } from "oicq";  

export class VideoParser extends plugin {
  constructor() {
    super({
      name: "视频解析类",
      description: "解析视频链接并返回视频",
      event: "message",
      priority: 0,
      rule: [
        {
          reg: "https://(?:www\\.)?(?:v\\.)?(douyin|kuaishou)\\.com/\\w+/?",
          fnc: "parseVideo",
        },
      ],
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
      await e.reply(segment.video(data.data.video));
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