(() => {
  const root = document.getElementById('tarot-table');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  const element = name => root.querySelector('#tt-' + name);
  const majorNames = ['愚者','魔术师','女祭司','皇后','皇帝','教皇','恋人','战车','力量','隐者','命运之轮','正义','倒吊人','死神','节制','恶魔','高塔','星星','月亮','太阳','审判','世界'];
  const roman = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
  const ranks = ['首牌','二','三','四','五','六','七','八','九','十','侍从','骑士','王后','国王'];
  const suits = ['权杖','圣杯','宝剑','星币'];
  const catalog = majorNames.map((name, index) => ({ id: index, name, major: index, serial: roman[index] }));
  suits.forEach((suit, suitIndex) => ranks.forEach((rank, rankIndex) => catalog.push({ id: catalog.length, name: suit + rank, suit: suitIndex, rank: rankIndex, serial: rankIndex < 10 ? String(rankIndex + 1) : ['P','N','Q','K'][rankIndex - 10] })));
  const STORAGE_KEY = 'shiguang-tarot:v1';
  const positions = { 3: ['现状','阻碍','建议'], 5: ['现状','阻碍','潜在影响','助力','下一步'] };
  let state;
  let pendingAction = 'shuffle';
  const randomInteger = ceiling => {
    if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * ceiling);
    const buffer = new Uint32Array(1);
    const limit = Math.floor(4294967296 / ceiling) * ceiling;
    do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % ceiling;
  };
  function newDeck() {
    const deck = catalog.map(card => ({ id: card.id, reversed: randomInteger(2) === 1 }));
    for (let remaining = deck.length - 1; remaining > 0; remaining--) {
      const swapIndex = randomInteger(remaining + 1);
      [deck[remaining], deck[swapIndex]] = [deck[swapIndex], deck[remaining]];
    }
    return deck;
  }
  function initialState() { return { version: 1, count: 3, deck: newDeck(), selected: [], revealed: false, reversals: true, question: '' }; }
  function validState(candidate) {
    return Boolean(candidate && candidate.version === 1 && [3,5].includes(candidate.count) &&
      Array.isArray(candidate.deck) && candidate.deck.length === 78 && new Set(candidate.deck.map(card => card?.id)).size === 78 &&
      candidate.deck.every(card => card && Number.isInteger(card.id) && card.id >= 0 && card.id < 78 && typeof card.reversed === 'boolean') &&
      Array.isArray(candidate.selected) && candidate.selected.length <= candidate.count && new Set(candidate.selected).size === candidate.selected.length &&
      candidate.selected.every(index => Number.isInteger(index) && index >= 0 && index < 78) &&
      typeof candidate.revealed === 'boolean' && (!candidate.revealed || candidate.selected.length === candidate.count) &&
      typeof candidate.reversals === 'boolean' && typeof candidate.question === 'string' && candidate.question.length <= 400);
  }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return validState(saved) ? saved : null;
    } catch {
      return null;
    }
  }
  function chosenCards() {
    return state.selected.map((deckIndex, order) => {
      const dealt = state.deck[deckIndex];
      return { order: order + 1, position: positions[state.count][order], name: catalog[dealt.id].name, orientation: state.reversals && dealt.reversed ? '逆位' : '正位', number: deckIndex + 1, id: dealt.id };
    });
  }
  function resultText() {
    const lines = ['拾光塔罗 · ' + state.count + ' 张牌阵', '问题：' + (state.question.trim() || '一般性的自我探索')];
    chosenCards().forEach(card => lines.push(card.order + '. ' + card.position + '：' + card.name + '（' + card.orientation + '）'));
    lines.push('牌面结果仅用于娱乐与自我探索。');
    return lines.join('\n');
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      element('storage').textContent = '当前问题和牌阵已保存在此浏览器。移动文件、无痕模式或清理浏览器数据可能使进度失效；可用「清除本地进度」删除。';
    } catch {
      element('storage').textContent = '浏览器未确认保存进度；请先复制需要保留的结果。';
    }
  }
  function message(words) { element('status').textContent = words; }
  function refreshControls() {
    root.querySelectorAll('[data-mode]').forEach(button => { button.setAttribute('aria-pressed', String(Number(button.dataset.mode) === state.count)); button.disabled = state.revealed; });
    element('reversals').checked = state.reversals;
    element('reversals').disabled = state.revealed;
    element('question').readOnly = state.revealed;
    if (element('question').value !== state.question) element('question').value = state.question;
    element('instruction').textContent = state.revealed ? '你的牌阵 · 按选择顺序' : '选 ' + state.count + ' 张你想翻开的牌';
    element('progress').textContent = '已选 ' + state.selected.length + ' / ' + state.count;
    element('reveal').textContent = '揭晓这 ' + state.count + ' 张';
    element('reveal').disabled = state.selected.length !== state.count;
    element('reveal').hidden = state.revealed;
    element('copy-result').hidden = !state.revealed;
    element('copy').hidden = !state.revealed;
    element('deck').hidden = state.revealed;
    element('spread').hidden = !state.revealed;
  }
  function selectCard(deckIndex) {
    if (state.revealed) return;
    const already = state.selected.indexOf(deckIndex);
    if (already >= 0) state.selected.splice(already, 1);
    else if (state.selected.length < state.count) state.selected.push(deckIndex);
    else { message('已经选齐了。可先取消一张再换牌，或直接揭晓。'); return; }
    refreshSelection(); refreshControls(); save();
    message(state.selected.length === state.count ? '已选齐。准备好了就揭晓；此时仍可以换牌。' : '点牌选择，再点一次可取消；选择顺序就是牌阵顺序。');
  }
  function buildDeck() {
    element('deck').replaceChildren();
    const fragment = document.createDocumentFragment();
    state.deck.forEach((dealt, deckIndex) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'back'; button.dataset.index = String(deckIndex);
      const badge = document.createElement('span'); badge.className = 'order'; badge.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.className = 'number'; label.textContent = String(deckIndex + 1).padStart(2, '0');
      button.append(badge, label); button.addEventListener('click', () => selectCard(deckIndex)); fragment.append(button);
    });
    element('deck').append(fragment); refreshSelection();
  }
  function refreshSelection() {
    element('deck').querySelectorAll('button').forEach(button => {
      const deckIndex = Number(button.dataset.index), selectionIndex = state.selected.indexOf(deckIndex);
      button.setAttribute('aria-pressed', String(selectionIndex >= 0));
      button.setAttribute('aria-label', '背面牌 ' + (deckIndex + 1) + (selectionIndex >= 0 ? '，第 ' + (selectionIndex + 1) + ' 张选择，再次点击取消' : '，点击选择'));
      button.querySelector('.order').textContent = selectionIndex >= 0 ? String(selectionIndex + 1) : '';
    });
  }
  function line(context, points, width = 2) {
    context.lineWidth = width; context.beginPath(); points.forEach((point, index) => index ? context.lineTo(...point) : context.moveTo(...point)); context.stroke();
  }
  function circle(context, horizontal, vertical, radius, fill = false) {
    context.beginPath(); context.arc(horizontal, vertical, radius, 0, Math.PI * 2); fill ? context.fill() : context.stroke();
  }
  function star(context, horizontal, vertical, radius, points = 5, rotation = -Math.PI / 2) {
    const coordinates = [];
    for (let point = 0; point <= points * 2; point++) { const angle = rotation + point * Math.PI / points, distance = point % 2 ? radius * .4 : radius; coordinates.push([horizontal + Math.cos(angle) * distance, vertical + Math.sin(angle) * distance]); }
    line(context, coordinates, 1.6);
  }
  function moon(context, horizontal, vertical, radius) {
    context.save(); circle(context, horizontal, vertical, radius, true); context.globalCompositeOperation = 'destination-out'; circle(context, horizontal + radius * .55, vertical - radius * .23, radius * .89, true); context.restore();
  }
  function rays(context, horizontal, vertical, inner, outer, count = 12) {
    for (let ray = 0; ray < count; ray++) { const angle = ray * Math.PI * 2 / count; line(context, [[horizontal + Math.cos(angle) * inner, vertical + Math.sin(angle) * inner], [horizontal + Math.cos(angle) * outer, vertical + Math.sin(angle) * outer]], 1.4); }
  }
  function flower(context, horizontal, vertical, radius = 28) {
    for (let petal = 0; petal < 6; petal++) { const angle = petal * Math.PI / 3; context.beginPath(); context.ellipse(horizontal + Math.cos(angle) * radius * .45, vertical + Math.sin(angle) * radius * .45, radius * .55, radius * .28, angle, 0, Math.PI * 2); context.stroke(); }
    circle(context, horizontal, vertical, radius * .18);
  }
  function crown(context, horizontal, vertical, size = 34) {
    line(context, [[horizontal-size,vertical+18],[horizontal-size-4,vertical-15],[horizontal-size*.45,vertical-2],[horizontal,vertical-28],[horizontal+size*.45,vertical-2],[horizontal+size+4,vertical-15],[horizontal+size,vertical+18],[horizontal-size,vertical+18]], 2);
    line(context, [[horizontal-size,vertical+11],[horizontal+size,vertical+11]], 1);
  }
  function branch(context, horizontal, vertical, direction = 1) {
    line(context, [[horizontal,vertical],[horizontal+direction*12,vertical-28],[horizontal+direction*10,vertical-57],[horizontal,vertical-83]], 1.5);
    for (let leaf = 0; leaf < 4; leaf++) { context.beginPath(); context.ellipse(horizontal + direction*(10+leaf%2*6), vertical-15-leaf*17, 10, 4, direction*-.7, 0, Math.PI*2); context.stroke(); }
  }
  function pip(context, suit, horizontal, vertical, scale = 1) {
    context.save(); context.translate(horizontal, vertical); context.scale(scale, scale); context.lineWidth = 2;
    if (suit === 0) { line(context,[[-6,19],[6,-19]],4); line(context,[[0,0],[-10,-9],[-7,-15]],1.5); line(context,[[4,-10],[14,-15]],1.5); }
    if (suit === 1) { context.beginPath(); context.moveTo(-14,-15); context.quadraticCurveTo(-16,9,0,8); context.quadraticCurveTo(16,9,14,-15); context.closePath(); context.stroke(); line(context,[[0,8],[0,20],[-11,20],[11,20]],2); line(context,[[-14,-11],[14,-11]],1); }
    if (suit === 2) { line(context,[[-4,9],[-4,-17],[0,-24],[4,-17],[4,9]],1.8); line(context,[[-12,9],[12,9]],2.8); line(context,[[0,9],[0,22]],4); circle(context,0,24,2); }
    if (suit === 3) { circle(context,0,0,17); star(context,0,0,13); }
    context.restore();
  }
  function majorArt(context, index) {
    if (index === 0) { circle(context,128,72,15); line(context,[[27,161],[57,139],[73,143],[99,121],[106,158],[152,160]]); line(context,[[54,126],[75,87],[92,91]]); circle(context,76,75,8); star(context,45,74,7); }
    if (index === 1) { context.beginPath(); context.moveTo(90,85); context.bezierCurveTo(40,47,37,121,90,85); context.bezierCurveTo(142,48,144,120,90,85); context.stroke(); line(context,[[90,111],[90,165]],3); star(context,90,120,16,4); }
    if (index === 2) { line(context,[[40,161],[40,73],[54,73],[54,161]]); line(context,[[126,161],[126,73],[140,73],[140,161]]); moon(context,90,107,25); star(context,90,61,8); }
    if (index === 3) { flower(context,90,100,38); line(context,[[90,133],[90,170]]); branch(context,56,168,1); branch(context,124,168,-1); }
    if (index === 4) { crown(context,90,95,36); line(context,[[27,163],[64,124],[86,159],[115,131],[153,163]]); }
    if (index === 5) { for (const direction of [-1,1]) { circle(context,90+direction*20,82,13); line(context,[[90+direction*13,94],[90-direction*30,159],[90-direction*18,167],[90-direction*13,158]],3); } star(context,90,53,8,4); }
    if (index === 6) { context.beginPath(); context.moveTo(90,135); context.bezierCurveTo(12,85,70,61,90,87); context.bezierCurveTo(112,60,166,89,90,135); context.stroke(); line(context,[[65,147],[90,166],[117,147]],1.5); star(context,90,55,9,4); }
    if (index === 7) { line(context,[[42,95],[53,140],[127,140],[138,95],[42,95]]); circle(context,63,153,13); circle(context,117,153,13); star(context,90,83,24,4); line(context,[[32,123],[15,123]]); }
    if (index === 8) { flower(context,90,114,44); circle(context,90,112,23); line(context,[[79,109],[84,109]]); line(context,[[98,109],[103,109]]); line(context,[[85,121],[90,125],[95,121]]); star(context,90,50,8,4); }
    if (index === 9) { line(context,[[64,91],[116,91],[110,151],[70,151],[64,91]]); line(context,[[64,91],[77,71],[103,71],[116,91]]); circle(context,90,63,9); star(context,90,118,18,6); line(context,[[60,160],[121,160]]); }
    if (index === 10) { circle(context,90,112,46); circle(context,90,112,32); circle(context,90,112,8); rays(context,90,112,9,45,8); }
    if (index === 11) { line(context,[[90,58],[90,161],[65,161],[115,161]],3); line(context,[[43,82],[136,82]],3); for (const offset of [-32,32]) { line(context,[[90+offset,83],[73+offset,126],[108+offset,126],[90+offset,83]],1.5); context.beginPath(); context.arc(90+offset,122,18,0,Math.PI); context.stroke(); } }
    if (index === 12) { line(context,[[41,63],[139,63]],3); line(context,[[90,63],[90,96],[110,112],[90,112],[90,143]]); circle(context,90,155,11); circle(context,90,155,22); line(context,[[67,127],[90,140],[114,127]]); }
    if (index === 13) { line(context,[[33,161],[147,161]],1.5); line(context,[[90,157],[90,112]],3); flower(context,90,88,31); context.beginPath(); context.ellipse(76,132,18,7,.55,0,Math.PI*2); context.stroke(); line(context,[[132,74],[143,91],[133,106]],1.5); }
    if (index === 14) { pip(context,1,56,91,1.4); pip(context,1,125,133,1.4); line(context,[[76,84],[93,102],[106,125]]); line(context,[[35,168],[54,163],[73,168],[93,163],[113,168],[139,163]],1.5); }
    if (index === 15) { for (const offset of [-24,24]) { context.beginPath(); context.ellipse(90+offset,115,20,32,offset>0?.5:-.5,0,Math.PI*2); context.stroke(); } line(context,[[84,129],[99,100]],4); star(context,90,59,14,5,Math.PI/2); }
    if (index === 16) { line(context,[[58,165],[63,94],[78,94],[78,81],[98,81],[98,94],[116,94],[122,165],[58,165]]); line(context,[[112,45],[82,91],[101,91],[78,129]],4); star(context,40,111,9,4); star(context,141,145,9,4); }
    if (index === 17) { star(context,90,101,36,8); [[40,65],[143,78],[37,136],[140,143]].forEach(([horizontal,vertical])=>star(context,horizontal,vertical,6,4)); line(context,[[42,164],[62,158],[81,164],[102,158],[122,164],[142,158]],1.5); }
    if (index === 18) { moon(context,90,92,34); star(context,137,65,8); line(context,[[33,172],[33,132],[47,120],[61,132],[61,172]]); line(context,[[120,172],[120,132],[134,120],[148,132],[148,172]]); }
    if (index === 19) { circle(context,90,112,31); circle(context,90,112,24); rays(context,90,112,41,57,16); line(context,[[78,109],[81,109]]); line(context,[[101,109],[104,109]]); context.beginPath(); context.arc(91,113,10,.2,Math.PI-.2); context.stroke(); }
    if (index === 20) { line(context,[[48,92],[77,88],[127,60],[127,126],[77,101],[48,105],[48,92]]); line(context,[[79,103],[72,126],[91,130],[98,115]]); rays(context,89,176,21,35,7); line(context,[[138,76],[152,65]]); line(context,[[139,96],[157,96]]); }
    if (index === 21) { context.beginPath(); context.ellipse(90,113,44,59,0,0,Math.PI*2); context.stroke(); branch(context,43,157,-1); branch(context,137,157,1); star(context,90,110,28,4); circle(context,90,110,13); }
  }
  function drawArt(canvas, card) {
    canvas.width=360; canvas.height=430;
    const context=canvas.getContext('2d'); if (!context) return;
    context.scale(2,2);
    const palette=getComputedStyle(element('palette'));
    context.strokeStyle=palette.color; context.fillStyle=palette.color; context.lineWidth=1.6; context.lineCap='round'; context.lineJoin='round';
    context.font='12px Georgia, serif'; context.textAlign='center'; context.fillText(card.serial,90,26);
    if (card.major!==undefined) majorArt(context,card.major);
    else if (card.rank<10) {
      const count=card.rank+1;
      if (count===1) { pip(context,card.suit,90,115,2); rays(context,90,115,55,64,12); }
      else { const rows=Math.ceil(count/2); for(let pipIndex=0;pipIndex<count;pipIndex++) { const lone=pipIndex===count-1&&count%2===1; const horizontal=lone?90:(pipIndex%2?121:59); const vertical=rows===1?116:61+Math.floor(pipIndex/2)*Math.min(106/(rows-1),72); pip(context,card.suit,horizontal,vertical,rows>3?.6:.85); } }
    } else { crown(context,90,74,card.rank>11?31:23); pip(context,card.suit,90,130,1.55); if(card.rank===11)line(context,[[43,151],[57,151],[47,162],[63,162]]); if(card.rank>=12){branch(context,45,173,-1);branch(context,135,173,1);} }
    star(context,90,195,4,4);
  }
  function buildSpread(animate=false) {
    const spread=element('spread'); spread.replaceChildren(); spread.dataset.count=String(state.count);
    if(!state.revealed)return;
    chosenCards().forEach((card,index)=>{
      const item=document.createElement('div'); item.className='drawn';
      const position=document.createElement('div'); position.className='position'; position.textContent=card.order+' · '+card.position;
      const front=document.createElement('div'); front.className='front';
      const canvas=document.createElement('canvas'); canvas.setAttribute('aria-hidden','true'); if(card.orientation==='逆位')canvas.className='reversed';
      const name=document.createElement('div'); name.className='name'; name.textContent=card.name;
      const orientation=document.createElement('div'); orientation.className='orientation'; orientation.textContent=card.orientation;
      front.append(canvas,name,orientation); item.append(position,front); spread.append(item); drawArt(canvas,catalog[card.id]);
      if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&front.animate)front.animate([{transform:'rotateY(85deg) scale(.95)'},{transform:'rotateY(0) scale(1)'}],{duration:420,delay:index*105,fill:'backwards',easing:'ease-out'});
    });
    element('result').value=resultText();
  }
  function render(){buildDeck();refreshControls();buildSpread();}
  function shuffle(){state.deck=newDeck();state.selected=[];state.revealed=false;element('confirm').hidden=true;element('copy').open=false;render();save();message('已重新洗好。每个编号对应的牌面已固定，等你选择。');}
  root.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    if(state.revealed)return;
    const nextCount=Number(button.dataset.mode),reduced=state.selected.length>nextCount;
    state.count=nextCount;state.selected=state.selected.slice(0,nextCount);refreshControls();refreshSelection();save();
    message(reduced?'已保留最先选择的三张。牌堆没有重新洗牌。':'已切换为'+state.count+'张牌。已有选择保留，牌堆没有改变。');
  }));
  element('reversals').addEventListener('change',()=>{if(state.revealed)return;state.reversals=element('reversals').checked;save();message(state.reversals?'本轮启用正逆位，牌面顺序不变。':'本轮全部按正位解读，牌面顺序不变。');});
  element('question').addEventListener('input',()=>{if(!state.revealed){state.question=element('question').value.slice(0,400);save();}});
  element('shuffle').addEventListener('click',()=>{
    pendingAction='shuffle';element('confirm-label').textContent='清空本轮选择，重新洗牌？';element('confirm-shuffle').textContent='确认洗牌';
    if(state.selected.length)element('confirm').hidden=false;else shuffle();
  });
  element('forget').addEventListener('click',()=>{
    pendingAction='forget';element('confirm-label').textContent='清除本页保存在此浏览器里的问题、牌阵和进度？';element('confirm-shuffle').textContent='确认清除';element('confirm').hidden=false;
  });
  element('confirm-shuffle').addEventListener('click',async()=>{
    if(pendingAction!=='forget'){shuffle();return;}
    state=initialState();element('confirm').hidden=true;element('copy').open=false;render();
    try{
      localStorage.removeItem(STORAGE_KEY);
      element('storage').textContent='已清除本页保存的问题和牌阵。下一次选择会保存新的进度。';message('本页进度已清除，可以重新开始。');
    }catch{element('storage').textContent='当前画面已清空，但浏览器未确认清除保存记录；如有需要，请在浏览器中清理本地站点数据。';message('已清空当前画面。');}
  });
  element('cancel-shuffle').addEventListener('click',()=>{element('confirm').hidden=true;});
  element('reveal').addEventListener('click',()=>{
    if(state.selected.length!==state.count||state.revealed)return;
    state.question=element('question').value.slice(0,400);state.revealed=true;refreshControls();buildSpread(true);save();
    message('牌面已固定，可以复制并记录本次结果。');element('copy-result').focus({preventScroll:true});
  });
  element('copy-result').addEventListener('click',()=>{
    if(!state.revealed)return;
    element('copy').open=true;
    const result=element('result');result.value=resultText();result.focus({preventScroll:true});result.select();
    let copied=false;try{copied=document.execCommand('copy');}catch{}
    message(copied?'已复制本次牌阵。':'结果已选中。请按 Ctrl+C 或长按复制。');
  });
  state=loadState()||initialState();render();
  if(state.revealed)message('已恢复本轮牌阵。可以复制结果或重新洗牌。');
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(state.revealed)buildSpread();});
})();
