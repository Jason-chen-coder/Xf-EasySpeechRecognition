<template>
    <div>
        <div> <!-- 按钮 -->
            <!-- <button @click="recOpen">打开录音,请求权限</button>
            | <button @click="recStart">开始录音</button>
              <button @click="recStop">结束录音</button>
            |  -->
            <!-- <button @click="recPlay">本地试听</button> -->
        </div>
        <div style="padding-top:5px"> <!-- 波形绘制区域 -->
            <div style="border:1px solid #ccc;display:inline-block;vertical-align:bottom">
                <div style="height:100px;width:300px;" ref="recwave"></div>
            </div>
        </div>
        <div id="listening-test"></div>
    </div>
    </template>
    
<script lang="ts" setup>
import { ref, watch } from 'vue'
//必须引入的核心
import Recorder from 'recorder-core'

//引入mp3格式支持文件；如果需要多个格式支持，把这些格式的编码引擎js文件放到后面统统引入进来即可
import 'recorder-core/src/engine/mp3'
import 'recorder-core/src/engine/mp3-engine'
//录制wav格式的用这一句就行
//import 'recorder-core/src/engine/wav'
//可视化插件：FrequencyHistogramView插件
import 'recorder-core/src/extensions/frequency.histogram.view'
import 'recorder-core/src/extensions/lib.fft'
const props = defineProps({
    status: String,
})

//可视化插件：WaveSurferView插件
// import 'recorder-core/src/extensions/wavesurfer.view'
let rec:any = null
// rec.open(success,fail) //打开录音，请求录音权限
// rec.close() //关闭录音，释放麦克风资源
// rec.start() //开始录音
// rec.stop(success,fail) //结束录音
// rec.pause() //暂停录音
// rec.resume() //恢复继续录音

let wave:any = null
let recBlob :any = null

watch(()=>props.status,()=>{
    console.log(props.status,'=======>props.status')
    if(props.status=='OPEN'){
        recOpen().then(()=>{
            recStart()
        })
    }else if(props.status === "CLOSED"){
        recStop()
    }
},{
    deep:true
})
const recwave  = ref()
const recOpen = () => {
	return new Promise((resolve,reject)=>{
    //创建录音对象
	rec=Recorder({
		type:"mp3" //录音格式，可以换成wav等其他格式
		,sampleRate:16000 //录音的采样率，越大细节越丰富越细腻
		,bitRate:16 //录音的比特率，越大音质越好
		,onProcess:(buffers: string | any[],powerLevel: any,bufferDuration: any,bufferSampleRate: any,newBufferIdx: any,asyncEnd: any)=>{
			//录音实时回调，大约1秒调用12次本回调
			//可实时绘制波形，实时上传（发送）数据
			if(wave) wave.input(buffers[buffers.length-1],powerLevel,bufferSampleRate);
		}
	});
	
	//打开录音，获得权限
	rec.open(()=>{
		console.log("录音已打开");
		if(recwave.value){//创建音频可视化图形绘制对象
			// wave=Recorder.FrequencyHistogramView({elem:recwave.value});
            wave=Recorder.FrequencyHistogramView({
                elem:recwave.value,
                lineCount:20
                ,position:0
                ,minHeight:1
                ,fallDuration:400
                ,stripeEnable:false
                ,mirrorEnable:true
                ,linear:[0,"#0ac",1,"#0ac"]
            });
		}
        resolve("success")
	},(msg: string,isUserNotAllow: any)=>{
		//用户拒绝了录音权限，或者浏览器不支持录音
		console.log((isUserNotAllow?"UserNotAllow，":"")+"无法录音:"+msg);
        reject("fail")
	});
    })
}

const recStart = () =>{
	if(!rec){ console.error("未打开录音");return }
	rec.start();
	console.log("已开始录音");
}

const recStop = () =>{
	if(!rec){ console.error("未打开录音");return }
	rec.stop((blob: Blob | MediaSource,duration: string)=>{
		//blob就是我们要的录音文件对象，可以上传，或者本地播放
		recBlob=blob;
		//简单利用URL生成本地文件地址，此地址只能本地使用，比如赋值给audio.src进行播放，赋值给a.href然后a.click()进行下载（a需提供download="xxx.mp3"属性）
		var localUrl=(window.URL||webkitURL).createObjectURL(blob);
		console.log("录音成功",blob,localUrl,"时长:"+duration+"ms");
		
		upload(blob);//把blob文件上传到服务器
		recPlay()
		rec.close();//关闭录音，释放录音资源，当然可以不释放，后面可以连续调用start
		rec=null;
	},(err: string)=>{
		console.error("结束录音出错："+err);
		rec.close();//关闭录音，释放录音资源，当然可以不释放，后面可以连续调用start
		rec=null;
	});
}
const upload = (blob: any) => {
	//使用FormData用multipart/form-data表单上传文件
	//或者将blob文件用FileReader转成base64纯文本编码，使用普通application/x-www-form-urlencoded表单上传
	var form=new FormData();
	form.append("upfile",blob,"recorder.mp3"); //和普通form表单并无二致，后端接收到upfile参数的文件，文件名为recorder.mp3
	form.append("key","value"); //其他参数
	
	var xhr=new XMLHttpRequest();
	xhr.open("POST", "/upload/xxxx");
	xhr.onreadystatechange=()=>{
		if(xhr.readyState==4){
			if(xhr.status==200){
				console.log("上传成功");
			}else{
				console.error("上传失败"+xhr.status);
			};
		};
	};
	xhr.send(form);
}

const recPlay = () => {
	//本地播放录音试听，可以直接用URL把blob转换成本地播放地址，用audio进行播放
	var localUrl=URL.createObjectURL(recBlob);
	var audio=document.createElement("audio");
	audio.controls=true;
	document.querySelector("#listening-test")?.appendChild(audio);
	audio.src=localUrl;
	audio.play(); //这样就能播放了
	
	//注意不用了时需要revokeObjectURL，否则霸占内存
	setTimeout(function(){ URL.revokeObjectURL(audio.src) },5000);
}
</script>

<style lang="scss" scoped>
#listening-test{
    margin-top: 20px;
} 
</style>