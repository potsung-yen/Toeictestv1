// ==========================================
// 全域變數與資料庫初始化 (含自動去重機制)
// ==========================================

// 🛡️ 自動去重函式：依據英文單字 (不分大小寫與前後空白) 過濾重複項目
function removeDuplicateWords(dataArray) {
    if (!Array.isArray(dataArray)) return [];
    const seen = new Set();
    return dataArray.filter(item => {
        if (!item || !item.english) return false;
        const cleanKey = item.english.trim().toLowerCase();
        if (seen.has(cleanKey)) {
            return false; // 已存在過，自動剔除
        }
        seen.add(cleanKey);
        return true; // 第一次出現，保留
    });
}

// 載入時自動執行去重
let rawWordList = typeof SpellingHeroData !== 'undefined' ? SpellingHeroData : [];
let wordList = removeDuplicateWords(rawWordList);

let currentPlayer = "冒險王";
let currentWord = {};

// 🎯 核心輪迴變數 (雙進度條與複測機制)
let currentRoundQueue = []; // 本回合要測試的單字陣列
let nextRoundQueue = [];    // 答錯後，被打入下一回合「複測」的單字陣列
let sessionTotalWords = 0;  // 這次測驗的總單字數
let masteredWords = 0;      // 已經「答對」的單字數 (用於計算總完成度)
let currentRoundIndex = 0;  // 本回合目前的題號
let roundNumber = 1;        // 回合數 (1=初測, 2=第1次複測, 以此類推)

// 玩家進度資料庫
let playerData = { score: 0, errorCounts: {}, customGroups: {} }; 

document.addEventListener("DOMContentLoaded", () => {
    loadUserData();
    
    // 綁定輸入框的 Enter 鍵
    const englishInput = document.getElementById("englishInput");
    if (englishInput) {
        englishInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && document.getElementById("submitBtn").style.display !== "none") {
                checkAnswer();
            }
        });
    }
});

// ==========================================
// 資料庫讀取與儲存 (LocalStorage)
// ==========================================
function loadUserData() {
    const nameInput = document.getElementById("playerName");
    if (nameInput) {
        currentPlayer = nameInput.value.trim() || "冒險王";
    }
    let data = localStorage.getItem(`SpHero_${currentPlayer}`);
    if (data) {
        playerData = JSON.parse(data);
        if (!playerData.errorCounts) playerData.errorCounts = {};
        if (!playerData.customGroups) playerData.customGroups = {};
    } else {
        playerData = { score: 0, errorCounts: {}, customGroups: {} };
    }
    
    const scoreElem = document.getElementById("score");
    if (scoreElem) scoreElem.innerText = playerData.score;
    updateDashboardUI();
    updateGroupSelect();
}

function saveUserData() {
    localStorage.setItem(`SpHero_${currentPlayer}`, JSON.stringify(playerData));
}

// ==========================================
// 系統自動分級與選單邏輯
// ==========================================
function getSystemLevel(errCount) {
    if (errCount >= 10) return "advanced";   // 高級
    if (errCount >= 3) return "intermediate"; // 中級
    return "beginner";                       // 初級
}

function getSystemLevelName(level) {
    if (level === "advanced") return "🔴 高級 (錯 10次+)";
    if (level === "intermediate") return "🟡 中級 (錯 3-9次)";
    return "🟢 初級 (錯 0-2次)";
}

function updateGroupSelect() {
    const select = document.getElementById("groupSelect");
    if (!select) return;
    select.innerHTML = "";
    
    let counts = { beginner: 0, intermediate: 0, advanced: 0 };
    wordList.forEach(w => {
        let errCount = playerData.errorCounts[w.english.toLowerCase()] || 0;
        counts[getSystemLevel(errCount)]++;
    });

    select.add(new Option(`📚 全部單字 (${wordList.length} 題)`, "all"));
    if (counts.beginner > 0) select.add(new Option(`${getSystemLevelName("beginner")} - ${counts.beginner}題`, "sys_beginner"));
    if (counts.intermediate > 0) select.add(new Option(`${getSystemLevelName("intermediate")} - ${counts.intermediate}題`, "sys_intermediate"));
    if (counts.advanced > 0) select.add(new Option(`${getSystemLevelName("advanced")} - ${counts.advanced}題`, "sys_advanced"));

    Object.keys(playerData.customGroups).forEach(groupName => {
        let size = playerData.customGroups[groupName].length;
        if (size > 0) select.add(new Option(`📁 ${groupName} (${size} 題)`, `cust_${groupName}`));
    });
}

// ==========================================
// 🗂️ 單字管理後台 (Dashboard) 邏輯
// ==========================================
function toggleDashboard() {
    const dash = document.getElementById("dashboardArea");
    if (!dash) return;
    dash.style.display = dash.style.display === "none" ? "block" : "none";
    if (dash.style.display === "block") updateDashboardUI();
}

function createCustomGroup() {
    const nameInput = document.getElementById("newGroupName");
    if (!nameInput) return;
    const groupName = nameInput.value.trim();
    if (!groupName) return alert("請輸入組別名稱！");
    if (playerData.customGroups[groupName]) return alert("這個組別已經存在囉！");

    playerData.customGroups[groupName] = [];
    saveUserData();
    nameInput.value = "";
    alert(`✅ 成功建立組別：${groupName}`);
    updateDashboardUI();
    updateGroupSelect();
}

function assignWordToGroup(wordEnglish, selectElement) {
    const groupName = selectElement.value;
    const wordKey = wordEnglish.toLowerCase();

    Object.keys(playerData.customGroups).forEach(g => {
        playerData.customGroups[g] = playerData.customGroups[g].filter(w => w !== wordKey);
    });

    if (groupName !== "none" && playerData.customGroups[groupName]) {
        playerData.customGroups[groupName].push(wordKey);
    }
    saveUserData();
    updateGroupSelect(); 
}

function updateDashboardUI() {
    const tbody = document.getElementById("wordTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const customGroupKeys = Object.keys(playerData.customGroups);
    let groupOptionsHTML = `<option value="none">-- 不加入 --</option>`;
    customGroupKeys.forEach(g => { groupOptionsHTML += `<option value="${g}">${g}</option>`; });

    wordList.forEach((w) => {
        let wordKey = w.english.toLowerCase();
        let errCount = playerData.errorCounts[wordKey] || 0;
        let sysLevel = getSystemLevel(errCount);
        let sysLevelName = getSystemLevelName(sysLevel);
        
        let currentGroup = "none";
        customGroupKeys.forEach(g => {
            if (playerData.customGroups[g].includes(wordKey)) currentGroup = g;
        });

        let tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #dfe6e9";
        tr.innerHTML = `
            <td style="padding: 10px; font-weight:bold;">${w.english}<br><span style="font-size:12px; color:#636e72; font-weight:normal;">${w.chinese}</span></td>
            <td style="padding: 10px; color: ${errCount > 0 ? '#d63031' : '#2d3436'}; font-weight: bold;">${errCount} 次</td>
            <td style="padding: 10px;">${sysLevelName}</td>
            <td style="padding: 10px;"><select onchange="assignWordToGroup('${w.english}', this)" style="padding:5px; border-radius:5px;">${groupOptionsHTML}</select></td>
        `;
        tr.querySelector('select').value = currentGroup;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 🚀 遊戲核心：測試與無限複測輪迴邏輯
// ==========================================
function startGame() {
    const groupSelect = document.getElementById("groupSelect");
    if (!groupSelect) return;
    const selectedGroup = groupSelect.value;
    let initialQueue = [];

    if (selectedGroup === "all") {
        initialQueue = [...wordList];
    } else if (selectedGroup.startsWith("sys_")) {
        const targetLevel = selectedGroup.replace("sys_", "");
        initialQueue = wordList.filter(w => getSystemLevel(playerData.errorCounts[w.english.toLowerCase()] || 0) === targetLevel);
    } else if (selectedGroup.startsWith("cust_")) {
        const groupName = selectedGroup.replace("cust_", "");
        const wordsInGroup = playerData.customGroups[groupName] || [];
        initialQueue = wordList.filter(w => wordsInGroup.includes(w.english.toLowerCase()));
    }

    if (initialQueue.length === 0) return alert("❌ 這個題庫目前沒有單字喔！");

    currentRoundQueue = [...initialQueue].sort(() => Math.random() - 0.5); 
    sessionTotalWords = currentRoundQueue.length;
    masteredWords = 0;
    nextRoundQueue = [];
    currentRoundIndex = 0;
    roundNumber = 1;
    
    document.getElementById("setupArea").style.display = "none";
    document.getElementById("dashboardArea").style.display = "none";
    document.getElementById("gameArea").style.display = "block";
    document.getElementById("progressArea").style.display = "block";
    
    nextQuestion();
}

function nextQuestion() {
    if (currentRoundIndex >= currentRoundQueue.length) {
        if (nextRoundQueue.length > 0) {
            roundNumber++;
            alert(`🔥 準備進入第 ${roundNumber - 1} 次複測！\n還有 ${nextRoundQueue.length} 個單字需要克服，加油！`);
            
            currentRoundQueue = [...nextRoundQueue].sort(() => Math.random() - 0.5); 
            nextRoundQueue = [];
            currentRoundIndex = 0;
        } else {
            alert(`🎉 恭喜！您已完美通關本組別的所有單字！\n總得分：${playerData.score}`);
            location.reload(); 
            return;
        }
    }

    currentWord = currentRoundQueue[currentRoundIndex];
    let modeElem = document.querySelector('input[name="gameMode"]:checked');
    let mode = modeElem ? modeElem.value : "spelling";
    
    document.getElementById("nextBtn").style.display = "none";
    document.getElementById("feedbackMsg").innerText = "";
    document.getElementById("chineseHint").innerText = currentWord.chinese;
    
    let overallPercent = (masteredWords / sessionTotalWords) * 100;
    document.getElementById("overallProgressBar").style.width = `${overallPercent}%`;
    document.getElementById("overallProgressText").innerText = `${masteredWords} / ${sessionTotalWords}`;

    let roundPercent = (currentRoundIndex / currentRoundQueue.length) * 100;
    document.getElementById("roundProgressBar").style.width = `${roundPercent}%`;
    document.getElementById("roundProgressText").innerText = `${currentRoundIndex + 1} / ${currentRoundQueue.length}`;
    document.getElementById("roundLabel").innerText = roundNumber === 1 ? "🔄 本回合進度 (初測)" : `🔄 本回合進度 (第 ${roundNumber - 1} 次複測)`;

    const sentenceHint = document.getElementById("sentenceHint");
    if (currentWord.sentence) {
        const cleanTarget = currentWord.english.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();
        const regex = new RegExp(cleanTarget, 'gi');
        sentenceHint.innerText = currentWord.sentence.replace(regex, "________");
    } else {
        sentenceHint.innerText = "";
    }

    if (mode === "spelling") {
        document.getElementById("spellingArea").style.display = "flex";
        document.getElementById("choiceArea").style.display = "none";
        const englishInput = document.getElementById("englishInput");
        englishInput.disabled = false;
        englishInput.value = "";
        document.getElementById("submitBtn").style.display = "inline-block";
        englishInput.focus();
    } else {
        document.getElementById("spellingArea").style.display = "none";
        document.getElementById("choiceArea").style.display = "flex";
        renderChoiceOptions();
    }
}

function renderChoiceOptions() {
    const choiceArea = document.getElementById("choiceArea");
    choiceArea.innerHTML = "";
    let wrongOptions = wordList.filter(w => w.english.toLowerCase() !== currentWord.english.toLowerCase());
    wrongOptions.sort(() => Math.random() - 0.5);
    
    let options = [currentWord, ...wrongOptions.slice(0, 3)].sort(() => Math.random() - 0.5);
    options.forEach(opt => {
        let btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerText = opt.english;
        btn.onclick = () => checkChoiceAnswer(btn, opt.english);
        choiceArea.appendChild(btn);
    });
}

function checkAnswer() {
    const userInput = document.getElementById("englishInput").value.trim().toLowerCase();
    if (!userInput) return; 
    processResult(userInput, false);
}

function checkChoiceAnswer(clickedBtn, selectedWord) {
    const choiceArea = document.getElementById("choiceArea");
    choiceArea.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
    
    if (selectedWord.toLowerCase() === currentWord.english.toLowerCase()) {
        clickedBtn.style.backgroundColor = "#00b894";
        clickedBtn.style.color = "white";
    } else {
        clickedBtn.style.backgroundColor = "#d63031";
        clickedBtn.style.color = "white";
        choiceArea.querySelectorAll(".option-btn").forEach(b => {
            if (b.innerText.toLowerCase() === currentWord.english.toLowerCase()) {
                b.style.backgroundColor = "#00b894";
                b.style.color = "white";
            }
        });
    }
    processResult(selectedWord, true);
}

function processResult(userInput, isChoiceMode) {
    const wordKey = currentWord.english.toLowerCase();
    let isCorrect = (userInput.toLowerCase() === wordKey);
    const feedback = document.getElementById("feedbackMsg");

    if (isCorrect) {
        feedback.innerText = "✨ 答對了！";
        feedback.className = "feedback correct";
        playerData.score += 10;
        masteredWords++; 
    } else {
        feedback.innerText = `❌ 錯誤！正解: ${currentWord.english}`;
        feedback.className = "feedback wrong";
        
        playerData.errorCounts[wordKey] = (playerData.errorCounts[wordKey] || 0) + 1;
        nextRoundQueue.push(currentWord);
    }

    if (currentWord.sentence) document.getElementById("sentenceHint").innerText = currentWord.sentence;
    
    saveUserData(); 
    document.getElementById("score").innerText = playerData.score;

    if (!isChoiceMode) {
        document.getElementById("englishInput").disabled = true;
        document.getElementById("submitBtn").style.display = "none";
    }

    currentRoundIndex++; 

    let overallPercent = (masteredWords / sessionTotalWords) * 100;
    document.getElementById("overallProgressBar").style.width = `${overallPercent}%`;
    document.getElementById("overallProgressText").innerText = `${masteredWords} / ${sessionTotalWords}`;
    let roundPercent = (currentRoundIndex / currentRoundQueue.length) * 100;
    document.getElementById("roundProgressBar").style.width = `${roundPercent}%`;

    if (document.getElementById("autoNext").checked) {
        setTimeout(() => nextQuestion(), isCorrect ? 1500 : 3500);
    } else {
        document.getElementById("nextBtn").style.display = "inline-block";
    }
}

function endGameEarly() {
    if (confirm("確定要提早結束本次測驗嗎？您的錯誤紀錄已保存。")) {
        location.reload();
    }
}

// ==========================================
// 輔助功能 (發音 / 解析 / 匯出錯題)
// ==========================================
function showWordInfo() {
    document.getElementById("modalWordTitle").innerText = currentWord.english;
    
    let youtubeLinkHTML = currentWord.youtube 
        ? `<p><b>▶️ 影音發音：</b> <a href="${currentWord.youtube}" target="_blank" style="color: #d63031; text-decoration: underline; font-weight: bold;">在 YouTube 上聽發音</a></p>` 
        : "";

    document.getElementById("modalWordContent").innerHTML = `
        <p><b>📝 意思：</b> ${currentWord.chinese}</p>
        <p><b>🧬 字根字首：</b> <span style="color:#d35400;">${currentWord.roots || "暫無資料"}</span></p>
        <p><b>🔄 同義字：</b> ${currentWord.synonyms || "無"}</p>
        <p><b>↔️ 反義字：</b> ${currentWord.antonyms || "無"}</p>
        <p><b>⚠️ 易混淆：</b> <span style="color:#c0392b;">${currentWord.confused || "無"}</span></p>
        ${youtubeLinkHTML}
    `;
    document.getElementById("infoModal").style.display = "flex";
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none"; 
}

function speakWord() {
    if (!currentWord || !currentWord.english) return;
    let utterance = new SpeechSynthesisUtterance(currentWord.english);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}

function exportMistakes() {
    let mistakes = wordList.filter(w => (playerData.errorCounts[w.english.toLowerCase()] || 0) > 0);
    if (mistakes.length === 0) { alert("🎉 目前沒有錯題紀錄！"); return; }
    
    let csv = "\uFEFF英文單字,中文意思,累積錯誤次數\n" + mistakes.map(w => `"${w.english}","${w.chinese}","${playerData.errorCounts[w.english.toLowerCase()]}"`).join("\n");
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `我的錯題本.csv`;
    link.click();
}
