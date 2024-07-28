<template>
  <button @click="startRecording()">
    {{ btnText }}
  </button>
  <br/>
  实时识别结果：{{ resultText }}
</template>

<script setup>
import {ref} from "vue";
import { hex_md5 } from "./md5"
import { CryptoJSNew } from "./HmacSHA1"
import '/src/voice-utils/utilJS/crypto-js.js'; //鉴权的引用地址
import '/src/voice-utils/utilJS/index.umd.js'; // 调用Web Speech API 的依赖，应该是官方的写的工具类
const btnText = ref("开始录音");
const btnStatus =  ref("UNDEFINED"); // "UNDEFINED" "CONNECTING" "OPEN" "CLOSING" "CLOSED"
const recorder = new RecorderManager('/src/voice-utils/dist')
const APPID = ""; // TODO 你的讯飞模型APPID
const API_SECRET = ""; // TODO 你的讯飞模型API_SECRET
const API_KEY = ""; // TODO 你的讯飞模型API_KEY
let iatWS; //监听录音的变量
let resultText = ref(''); // 识别结果
let resultTextTemp = ref('');
let countdownInterval;
// 生成 WebSocket URL 生成规则由平台决定
function getWebSocketUrl() {
  var url = "wss://rtasr.xfyun.cn/v1/ws";
    var appId = APPID;
    var secretKey = API_KEY;
    var ts = Math.floor(new Date().getTime() / 1000);
    var signa = hex_md5(appId + ts);
    var signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
    var signature = CryptoJS.enc.Base64.stringify(signatureSha);
    signature = encodeURIComponent(signature);
    return `${url}?appid=${appId}&ts=${ts}&signa=${signature}`;
}
// 加密工具函数
function toBase64(buffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
// 计数函数
function countdown() {
  let seconds = 60;
  btnText.value = `录音中（${seconds}s）`;
  countdownInterval = setInterval(() => {
    seconds = seconds - 1;
    if (seconds <= 0) {
      clearInterval(countdownInterval);
      recorder.stop();
    } else {
      btnText.value = `录音中（${seconds}s）`;
    }
  }, 1000);
}
// 录音状态变化函数
function changeStatus(status) {
  btnStatus.value = status;
  if (status === "CONNECTING") {
    btnText.value = "建立连接中";
    resultText.value = '';
    resultTextTemp.value = "";
  } else if (status === "OPEN") {
    countdown();
  } else if (status === "CLOSING") {
    btnText.value = "关闭连接中";
  } else if (status === "CLOSED") {
    btnText.value = "开始录音";
  }
}
// 结果解析函数
function renderResult(resultData) {
  // 识别结束
  let jsonData = JSON.parse(resultData);
    if (jsonData.action == "started") {
      // 握手成功
      console.log("握手成功");
    } else if (jsonData.action == "result") {
      const data = JSON.parse(jsonData.data)
      console.log(data)
      // 转写结果
      let resultTextTemp = ""
      data.cn.st.rt.forEach((j) => {
        j.ws.forEach((k) => {
          k.cw.forEach((l) => {
            resultTextTemp += l.w;
          });
        });
      });
      if (data.cn.st.type == 0) {
        // 【最终】识别结果：
        resultText.value = resultText.value + resultTextTemp;
        resultTextTemp = ""
      }
      console.log("resultText===>",resultText.value);
    } else if (jsonData.action == "error") {
      // 连接发生错误
      console.log("出错了:", jsonData);
    }
}
// 连接 WebSocket
function connectWebSocket() {
  const websocketUrl = getWebSocketUrl();
  if ("WebSocket" in window) {
    iatWS = new WebSocket(websocketUrl);
  } else if ("MozWebSocket" in window) {
    iatWS = new MozWebSocket(websocketUrl);
  } else {
    alert("浏览器不支持WebSocket");
    return;
  }
  changeStatus("CONNECTING");
  iatWS.onopen = (e) => {
      // 开始录音
      recorder.start({
        sampleRate: 16000,
        frameSize: 1280,
      });
    };
    iatWS.onmessage = (e) => {
      renderResult(e.data);
    };
    iatWS.onerror = (e) => {
      console.error(e);
      recorder.stop();
      changeStatus("CLOSED");
    };
    iatWS.onclose = (e) => {
      recorder.stop();
      changeStatus("CLOSED");
    };
}
// 定义监听开始的函数
recorder.onStart = () => {
  changeStatus("OPEN");
}
// 处理回调的结果
recorder.onFrameRecorded = ({ isLastFrame, frameBuffer }) => {
    if (iatWS.readyState === iatWS.OPEN) {
      iatWS.send(new Int8Array(frameBuffer));
      if (isLastFrame) {
        iatWS.send('{"end": true}');
        changeStatus("CLOSING");
      }
    }
  };
// 停止录音的处理
recorder.onStop = () => {
  clearInterval(countdownInterval);
};
// 按钮点击的启动 | 结束函数
const startRecording = () => {
  if (btnStatus.value === "UNDEFINED" || btnStatus.value === "CLOSED") {
    connectWebSocket();
  } else if (btnStatus.value === "CONNECTING" || btnStatus.value === "OPEN") {
    // 结束录音
    recorder.stop();
  }
}
</script>

<style scoped>

</style>
