(()=>{
const T=window.OPENX_TOKENS;
const swatch=value=>`<span class="color-value"><i style="--chip:${value}" aria-hidden="true"></i>${value}</span>`;
const rows=[['强调色','seriesPrimary','主操作底色、关键步骤、主要图表系列'],['辅助文字','muted','日期、单位、描述与次级信息'],['辅助背景','canvas','页面底层与非内容区域'],['辅助分隔','border','同一对象内的分隔和卡片边界'],['中性选中','selected','选中项目的底色，配合文字或图标'],['辅助数据','seriesComparison','对比曲线；配合虚实线与系列名称']];
const body=document.getElementById('cr-roles-table');if(!body)return;
body.innerHTML=rows.map(([label,key,note])=>`<tr><td>${label}</td><td>${swatch(T.light[key])}</td><td>${swatch(T.dark[key])}</td><td>${note}</td></tr>`).join('');
const stateRows=[['成功','success','操作成功或连接正常'],['错误','danger','失败、无效或需要修正'],['注意','warning','有条件、待处理或需要确认'],['说明','info','补充说明和信息反馈']];
body.closest('.cr-system').querySelector('.cr-notes').insertAdjacentHTML('afterend',`<details class="color-method"><summary>查看状态文字色与柔和背景色</summary><div class="table-wrap"><table class="rules-table"><thead><tr><th>状态</th><th>浅色界面文字 / 背景</th><th>深色界面文字 / 背景</th><th>含义</th></tr></thead><tbody>${stateRows.map(([label,key,note])=>`<tr><td>${label}</td><td>${swatch(T.light[key])}<br>${swatch(T.light[key+'Soft'])}</td><td>${swatch(T.dark[key])}<br>${swatch(T.dark[key+'Soft'])}</td><td>${note}</td></tr>`).join('')}</tbody></table></div><p class="rule-note">这些颜色用于需要强调的反馈。普通账户列表仍采用中性状态；危险确认按钮使用专门的 dangerAction 色，保证白字可读。</p></details>`);
})();
