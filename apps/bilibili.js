import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import Yaml from 'yaml';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import plugin from '../../../lib/plugins/plugin.js'; // 确认路径并调整

const card = true;
const Referer = 'https://www.bilibili.com/';
const cfg = Yaml.parse(fs.readFileSync(path.resolve(__dirname, '../config/config.yaml'), 'utf8'));
const { Cookie } = cfg; // 从config/config.yaml中读取Cookie

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Bili_Down extends plugin {
  constructor() {
    super({
      name: 'b站卡片解析',
      dsc: '解析b站卡片信息',
      event: 'message',
      priority: 14,
      rule: [
        {
          reg: 'https://b23.tv/',
          fnc: 'get_share_url'
        },
        {
          reg: 'https://www.bilibili.com/video/BV',
          fnc: 'get_bv'
        }
      ]
    });
  }

  async get_share_url(e) {
    if (e.message && e.message.length > 0 && e.message[0].type === 'json' && card) {
      let obj = JSON.parse(e.message[0].data);
      let jumpUrl = obj.meta.news?.jumpUrl || obj.meta.detail_1?.qqdocurl;
      e.msg = jumpUrl;
    }
    return await this.get_bv(e);
  }

  async get_bv(e) {
    let url = e.msg.match(/https:\/\/(\S+)/)[0];
    if (url.match(/https:\/\/b23\.tv\//)) url = (await fetch(url)).url;
    url = url.indexOf('?') !== -1 ? url.substring(0, url.indexOf('?')) : url;
    url = url.replace(/https:\/\/www\.bilibili\.com\/video\/BV/, '').replace(/\//, '');
    return await this.get_info(url);
  }

  async get_info(bv) {
    let res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`, {
      method: 'get',
      headers: { Cookie, Referer }
    });

    res = await res.json();

    // 添加日志检查 API 响应
    console.log('API response:', res);

    if (!res.data) {
      console.error('API response data is undefined');
      return await this.reply('获取视频信息失败，请稍后重试');
    }

    const { duration, cid, rid } = res.data;
    if (duration > 3000) return await this.reply('视频过长，无法解析');
    let qn = rid === 120 ? 120 : 116;
    return await this.get_video_url(bv, cid, qn);
  }

  async get_video_url(bv, cid, qn) {
    let res = await fetch(`https://api.bilibili.com/x/player/playurl?bvid=${bv}&cid=${cid}&qn=${qn}&fnval=16&type=mp4`, {
      method: 'get',
      headers: {
        Cookie,
        Referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36'
      }
    });

    const url = await res.json();
    const _path = path.resolve(__dirname, `../../../resources/${Date.now()}`);
    const m4s = `${_path}.m4s`;
    const mp3 = `${_path}.mp3`;
    const mp4 = `${_path}.mp4`;

    /** 视频流 */
    await this.getFile(url.data.dash.video[0].baseUrl, m4s);
    /** 伴音流 */
    await this.getFile(url.data.dash.audio[0].baseUrl, mp3);
    /** 混流 */
    await this.runFfmpeg(m4s, mp3, mp4);
    /** 混流完成删除临时文件 */
    if (fs.existsSync(m4s)) fs.unlink(m4s, (err) => { if (err) console.error(err); });
    if (fs.existsSync(mp3)) fs.unlink(mp3, (err) => { if (err) console.error(err); });
    /** 发送 */
    try {
      console.log(`Sending video: file://${mp4}`); // 添加日志
      await this.reply({ type: 'video', file: `file://${mp4}` }); // 确认使用文件路径发送
    } catch (error) {
      console.error(`回复消息失败: ${error}`);
    }
  }

  /** 下载缓存文件 */
  async getFile(url, filePath) {
    url = await fetch(url, {
      headers: {
        Referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36'
      }
    });
    fs.writeFileSync(filePath, Buffer.from(await url.arrayBuffer()));
  }

  /** ffmpeg转码 转为pcm */
  async runFfmpeg(m4s, mp3, mp4) {
    let cm;
    let ret = await new Promise((resolve) => exec('ffmpeg -version', { windowsHide: true }, (error, stdout, stderr) => resolve({ error, stdout, stderr })));
    return new Promise((resolve, reject) => {
      if (ret.stdout) {
        cm = 'ffmpeg';
      } else {
        const cfg = Yaml.parse(fs.readFileSync(path.resolve(__dirname, '../../../config/config/bot.yaml'), 'utf8'));
        cm = cfg.ffmpeg_path ? `"${cfg.ffmpeg_path}"` : null;
      }

      if (!cm) {
        throw new Error('未检测到 ffmpeg ，无法进行转码，请正确配置环境变量或手动前往 bot.yaml 进行配置');
      }

      exec(`${cm} -i "${m4s}" -i "${mp3}" -c:v copy -c:a copy -f mp4 "${mp4}"`, async (error, stdout, stderr) => {
        if (error) {
          console.error('Lain-plugin', `执行错误: ${error}`);
          reject(error);
          return;
        }
        console.log(`ffmpeg转码完成：${m4s} + ${mp3} => ${mp4}`);
        resolve();
      });
    });
  }
}