'use strict';
const modules=[
 {name:'ST7789',photo:'https://elmwoodelectronics.ca/cdn/shop/products/4313-02_2048x.jpg?v=1563911716',source:'https://www.adafruit.com/product/4313',pins:[['42','SCLK'],['41','MOSI'],['1','DC'],['2','RST']],saved:[['41','SCLK'],['42','MOSI'],['46','DC'],['17','RST']],note:'SPI 240 × 240. CS và đèn nền không có GPIO điều khiển riêng trong cấu hình mặc định.'},
 {name:'ICS-43434',photo:'https://cdn-blog.adafruit.com/uploads/2024/09/6049_iso_ORIG_2024_09-scaled.jpg',source:'https://www.adafruit.com/product/6049',pins:[['4','WS'],['5','SCK'],['6','SD']],note:'Micro I²S kênh trái. Nguồn và logic 3,3 V.'},
 {name:'MAX98357A',photo:'https://cdn-shop.adafruit.com/970x728/3006-06.jpg',source:'https://www.adafruit.com/product/3006',pins:[['15','BCLK'],['16','LRCLK'],['7','DIN']],note:'Chân SD/MODE nối VIN theo thiết kế robot. Loa nối vào cặp ngõ ra của ampli.'},
 {name:'PCM5102A / KCX',photo:'https://distancionka.com/upload/iblock/8f5/blq10gvzfsz2q8otunw153yw18k99w24.jpg',source:'https://distancionka.com/catalog/arduino/moduli/modul-pcm5102a-tsap-stereo-24-bit-dlya-vosproizvedeniya-zvuka-po-shine-i2s/',pins:[['15','BCLK'],['16','LRCLK'],['7','DIN']],note:'PCM dùng chung I²S với MAX. PCM ROUT sang hai ngõ AUDIO_L/R của KCX. LOUT để hở.'},
 {name:'Servo MG90S',photo:'https://botland.store/img/art/inne/24408_5.jpg',source:'https://botland.store/micro-servos/24408-towerpro-mg90s-micro-analogue-servo-with-metal-gear.html',pins:[['12','PWM cổ'],['13','PWM đầu']],note:'Nguồn servo theo module, chung GND với bo điều khiển.'},
 {name:'TTP223 / LED',photo:'https://i0.wp.com/elecsynergy.com/wp-content/uploads/2024/08/61AbmtMMUtL.jpg?ssl=1',source:'https://elecsynergy.com/introduction-to-ttp223-red/',pins:[['0','TTP223 OUT'],['48','LED PWM']],saved:[['0','BOOT'],['3','LED PWM']],note:'TTP223 jumper A, chạm ở mức thấp. GPIO0 cũng là chân BOOT.'},
 {name:'APDS-9930',photo:'https://www.tomsonelectronics.com/cdn/shop/products/APDS_9930_1.jpg?v=1764678430',source:'https://www.tomsonelectronics.com/products/digital-proximity-and-ambient-light-sensor-for-arduino-apds-9930',pins:[],saved:[['18','SDA'],['9','SCL']],note:'Cảm biến tiệm cận I²C.'},
 {name:'OLED I²C',photo:'https://cdn.shopify.com/s/files/1/0069/6513/3376/products/AA139_550x.jpg?v=1557283862',source:'https://kuongshun.com/products/blue-i2c-iic-oled-lcd-module',pins:[],saved:[['39','SDA'],['40','SCL']],note:'OLED phụ. Chọn đúng bộ điều khiển trong cấu hình robot.'},
 {name:'ToF VL53L0X',photo:'https://thepihut.com/cdn/shop/products/adafruit-vl53l0x-time-of-flight-distance-sensor-30-to-1000mm-adafruit-ada3317-28610220818627.jpg?v=1646678165&width=1200',source:'https://thepihut.com/products/adafruit-vl53l0x-time-of-flight-distance-sensor-30-to-1000mm',pins:[],saved:[['10','SDA'],['11','SCL']],note:'Cảm biến khoảng cách và mép bàn.'},
 {name:'L298N',photo:'https://makerhub.my/assets/uploads/LN298NBF521864A.png',source:'https://makerhub.my/shop/actuator/l298n-motor-driver-module-arduino-compatible-dual-h-bridge-dual-dc-motor-control-for-arduino-robotic-car-project/',pins:[],saved:[['8','IN1'],['21','IN2'],['1','IN3'],['2','IN4']],note:'Tín hiệu điều khiển hai động cơ.'}
];
const profile=document.querySelector('#wiring-profile');
const map=document.querySelector('.wiring-map');
function draw(){
  const board=document.createElement('div');
  board.className='map-board';
  board.innerHTML='<img loading="lazy" src="https://lafvintech.com/cdn/shop/files/LA066A3-1_800x.jpg?v=1779175185" alt=""><strong>ESP32-S3</strong>';
  const columns=[document.createElement('div'),document.createElement('div')];
  columns.forEach(column=>column.className='map-column');
  modules.forEach((module,index)=>{
    const pins=profile.value==='saved'?(module.saved??module.pins):module.pins;
    const card=document.createElement('div');
    card.className='map-module';
    const image=document.createElement('img');
    image.loading='lazy';image.src=module.photo;image.alt='';
    const name=document.createElement('a');
    name.href=module.source;name.target='_blank';name.rel='noopener noreferrer';name.textContent=module.name;
    const signals=document.createElement('div');
    signals.className='signals';
    pins.forEach(([gpio,signal],pinIndex)=>{
      const line=document.createElement('span');
      line.textContent=signal+' · GPIO'+gpio;
      line.style.setProperty('--wire',['#3cbca1','#4597df','#d6a34d','#ae71cb'][pinIndex]);
      signals.append(line);
    });
    if(!pins.length)signals.textContent='Chưa gán GPIO';
    card.append(image,name,signals);
    columns[index<5?0:1].append(card);
  });
  map.replaceChildren(columns[0],board,columns[1]);
}
profile.addEventListener('change',draw);
draw();
const clock=document.querySelector('#clock-style'),emoji=document.querySelector('#emoji-style');
clock.onchange=()=>{
  const preview=document.querySelector('#clock-preview');
  preview.className='screen '+['flip','modular','mini','analog','black-modular'][Number(clock.value)];
  preview.firstElementChild.textContent=clock.value==='4'?'THỨ 7  08':'THỨ 7';
  preview.children[1].textContent=clock.value==='3'?'':'10:09';
  preview.querySelector('small').textContent=clock.value==='2'?'HYNHI ROBOT':'THỜI TIẾT';
  preview.querySelector('.watch-complications')?.remove();
  if(Number(clock.value)>=3){
    const details=document.createElement('div');
    details.className='watch-complications';
    const labels=clock.value==='3'?['UV --','AQI --','26°','☀','62%','dB --','Mưa --']:['☀','Chưa có dữ liệu nhịp tim','TEMP','AQI --','HUM'];
    for(const label of labels){const item=document.createElement('span');item.textContent=label;details.append(item);}
    preview.append(details);
  }

};
clock.onchange();
emoji.onchange=()=>{const preview=document.querySelector('#emoji-preview');preview.src=emoji.value==='1'?'images/girl.gif':'images/boy.gif';preview.alt=emoji.selectedOptions[0].textContent;};
document.querySelector('#theme-form').onsubmit=event=>{
  event.preventDefault();
  const address=document.querySelector('#robot-address').value.trim();
  const status=document.querySelector('#theme-status');
  if(!/^\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?$/.test(address)){status.textContent='Nhập IP nội bộ của robot, ví dụ 192.168.1.8:8080.';return;}
  try{
    const target=new URL('http://'+address);
    target.port=target.port||'8080';
    target.search=new URLSearchParams({hynhi_clock:clock.value,hynhi_emoji:emoji.value});
    target.hash='clock';
    location.href=target.href;
  }catch{status.textContent='Địa chỉ robot không hợp lệ.';}
};
function loadVariant(v){
  const installer=document.querySelector('#installer'),link=document.querySelector('#manifest-link');
  installer.setAttribute('manifest','firmware/'+v+'/manifest.json');link.href='firmware/'+v+'/manifest.json';
  profile.value=v==='default'?'default':'saved';profile.dispatchEvent(new Event('change'));
  fetch('firmware/'+v+'/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(manifest=>{
    document.querySelector('#flash-status').textContent='Gói '+manifest.version+' · '+manifest.builds[0].chipFamily+' · '+manifest.builds[0].parts.length+' phần nạp.';
  }).catch(()=>{document.querySelector('#flash-status').textContent='Chưa tìm thấy gói firmware cho bản này.';});
}
for(const radio of document.querySelectorAll('input[name=variant]'))radio.addEventListener('change',()=>loadVariant(radio.value));
loadVariant('custom');
