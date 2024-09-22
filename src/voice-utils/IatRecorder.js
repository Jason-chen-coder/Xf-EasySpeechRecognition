 
const APPID = '' // 科大讯飞id
const API_KEY = '' // 科大讯飞api_key
import CryptoJS from 'crypto-js'
import Worker from './transcode.worker.js'
import { hex_md5 } from './md5'
const recorderWorker = new Worker()
 
function getWebSocketUrl() {
  return new Promise((resolve, reject) => {
    // 请求地址根据语种不同变化
    var url = 'wss://rtasr.xfyun.cn/v1/ws'
    var appId = APPID
    var secretKey = API_KEY
    var ts = Math.floor(new Date().getTime() / 1000);//new Date().getTime()/1000+'';
    var signa = hex_md5(appId + ts)//hex_md5(encodeURIComponent(appId + ts));//EncryptUtil.HmacSHA1Encrypt(EncryptUtil.MD5(appId + ts), secretKey);
    var signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey)
    var signature = CryptoJS.enc.Base64.stringify(signatureSha)
    url = url + "?appid=" + appId + "&ts=" + ts + "&signa=" + signature;
    resolve(url)
  })
}
const IatRecorder = class {
  constructor({ language, appId } = {}) {
    let self = this
    this.status = 'null'
    this.language = language || 'cn'
    this.appId = appId || APPID
    // 记录音频数据
    this.buffer = []
    // 记录听写结果
    this.resultText = ''
    // wpgs下的听写结果需要中间状态辅助记录
    this.resultTextTemp = ''
    recorderWorker.onmessage = function (event) {
      self.buffer.push(...event.data)
    }
  }
  setStatus(status) {
    this.onWillStatusChange && this.status !== status && this.onWillStatusChange(this.status, status)
    this.status = status
  }
 
  // 连接websocket
  connectWebSocket() {
    return getWebSocketUrl().then(url => {
      let iatWS
      if ('WebSocket' in window) {
        iatWS = new WebSocket(url)
      } else if ('MozWebSocket' in window) {
        iatWS = new MozWebSocket(url)
      } else {
        alert('浏览器不支持WebSocket')
        return
      }
      this.webSocket = iatWS
      this.setStatus('init')
      iatWS.onopen = e => {
        this.setStatus('ing')
        this.mediaSource.connect(this.scriptProcessor)
        this.scriptProcessor.connect(this.audioContext.destination)
        // 重新开始录音
        setTimeout(() => {
          this.webSocketSend()
        }, 500)
      }
      iatWS.onmessage = e => {
        this.result(e.data)
      }
      iatWS.onerror = e => {
        this.stop()
      }
      iatWS.onclose = e => {
        endTime = Date.parse(new Date())
        this.stop()
      }
    })
  }
 
  recorderStart() {
    this.stop()
    // 创造音频环境
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.audioContext.resume()
      if (!this.audioContext) {
        alert('浏览器不支持webAudioApi相关接口')
        return
      }
    } catch (e) {
      if (!this.audioContext) {
        alert('浏览器不支持webAudioApi相关接口')
        return
      }
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false,
        })
        .then(stream => {
          getMediaSuccess(stream)
        })
        .catch(e => {
          getMediaFail(e)
        })
    } else if (navigator.getUserMedia) {
      navigator.getUserMedia(
        {
          audio: true,
          video: false,
        },
        stream => {
          getMediaSuccess(stream)
        },
        function (e) {
          getMediaFail(e)
        }
      )
    } else {
      if (navigator.userAgent.toLowerCase().match(/chrome/) && location.origin.indexOf('https://') < 0) {
        alert('chrome下获取浏览器录音功能，因为安全性问题，需要在localhost或127.0.0.1或https下才能获取权限')
      } else {
        alert('无法获取浏览器录音功能，请升级浏览器或使用chrome')
      }
      this.audioContext && this.audioContext.close()
      return
    }
    // 获取浏览器录音权限成功的回调
    let getMediaSuccess = stream => {
      // 创建一个用于通过JavaScript直接处理音频
      this.scriptProcessor = this.audioContext.createScriptProcessor(0, 1, 1)
      this.scriptProcessor.onaudioprocess = e => {
        // 去处理音频数据
        if (this.status === 'ing') {
          recorderWorker.postMessage(e.inputBuffer.getChannelData(0))
        }
      }
      // 创建一个新的MediaStreamAudioSourceNode 对象，使来自MediaStream的音频可以被播放和操作
      this.mediaSource = this.audioContext.createMediaStreamSource(stream)
      // 连接
      this.mediaSource.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)
      this.connectWebSocket()
      let getMediaFail = (e) => {
        alert('请求麦克风失败')
        this.audioContext && this.audioContext.close()
        this.audioContext = undefined
        // 关闭websocket
        if (this.webSocket && this.webSocket.readyState === 1) {
          this.webSocket.close()
        }
      }
    }
  }
  ArrayBufferToBase64(buffer) {
    var binary = ''
    var bytes = new Uint8Array(buffer)
    var len = bytes.byteLength
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
  sendData(buffer) {
    recorderWorker.postMessage({
      command: 'transform',
      buffer: buffer
    })
  }
  // 向webSocket发送数据
  webSocketSend() {
    if (this.webSocket.readyState !== 1) {
      return
    }
    var audioData = this.buffer.splice(0, 1280)
    this.webSocket.send(new Int8Array(audioData))
    this.handlerInterval = setInterval(() => {
      // websocket未连接
      if (this.webSocket.readyState !== 1) {
        clearInterval(this.handlerInterval)
        return
      }
      if (this.buffer.length === 0) {
        if (this.state === 'end') {
          this.webSocket.send("{\"end\": true}")
          console.log("发送结束标识");
          clearInterval(this.handlerInterval)
        }
        return false
      }
      var audioData = this.buffer.splice(0, 1280)
      if (audioData.length > 0) {
        this.webSocket.send(new Int8Array(audioData))
      }
    }, 40)
  }
  result(resultData) {
    // 识别结束
    // let jsonData = JSON.parse(e.data)
    let jsonData = JSON.parse(resultData)
    if (jsonData.action == "started") {
      // 握手成功
      console.log("握手成功");
    } else if (jsonData.action == "result") {
      // 转写结果
      this.setResult(JSON.parse(jsonData.data))
    } else if (jsonData.action == "error") {
      // 连接发生错误
      console.log("出错了:", jsonData);
    }
  }
  setResult(data) {
    let rtasrResult = []
    // console.log(data)
    rtasrResult[data.seg_id] = data
    rtasrResult.forEach(i => {
      let str = "实时转写"
      str += (i.cn.st.type == 0) ? "【最终】识别结果：" : "【中间】识别结果："
      i.cn.st.rt.forEach(j => {
        j.ws.forEach(k => {
          k.cw.forEach(l => {
            str += l.w
          })
        })
      })
      console.log(str,'str')
    })
  }
  start() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia
    this.recorderStart()
  }
  stop() {
    this.state = 'end'
    try {
      this.mediaStream.disconnect(this.recorder)
      this.recorder.disconnect()
    } catch (e) { }
  }
}
 
export default IatRecorder