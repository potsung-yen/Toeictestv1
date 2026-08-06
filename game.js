let wordList = typeof SpellingHeroData !== 'undefined' ? SpellingHeroData : [];
let currentPlayer = "";
let currentWord = {};
let isBossMode = false;
let testQueue = []; // 存放本次測試的單字清單
let currentIndex = 0; // 目前進度

// 監聽鍵盤事件
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("englishInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") checkAnswer();
    });
    document.getElementById("searchInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchWord();
    });
});

// 切換分組顯示
function handleGroupChange() {
    const val = document.getElementById("groupSelect").value;
    document.getElementById("customRangeArea").style.display = (val === "custom") ? "flex" : "none";
}

// 遊戲初始化
function startGame() {
    currentPlayer = document.getElementById("playerName").value.trim() || "冒險王";
    let mode = document.querySelector('input[name="gameMode"]:checked').value;
    
    // 建立題庫佇列
    testQueue = generateTestQueue();
    if (testQueue.length === 0) {
        alert("請確認題庫範圍是否正確！");
        return;
    }

    currentIndex = 0;
    isBossMode = false;
    
    document.getElementById("setupArea").style.display = "none";
    document.getElementById("gameArea").style.display = "block";
    document.getElementById("progressContainer").style.display = "block";
    document.getElementById("progressText").style.display = "block";
    
    updateScoreBoard();
    nextQuestion();
}

// 生成本次測試清單
function generateTestQueue() {
    let list = [];
    const groupVal = document.getElementById("groupSelect").value;
    
    if (groupVal === "all") {
        list = [...wordList];
    } else if (groupVal.startsWith("group")) {
        const groupNum = parseInt(groupVal.replace("group", ""));
        const start = (groupNum - 1) * 10;
        list = wordList.slice(start, start + 10);
    } else {
        let start = parseInt(document.getElementById("startIdx").value) || 1;
        let end = parseInt(document.getElementById("endIdx").value) || wordList.length;
        list = wordList.slice(Math.max(0, start - 1), Math.min(wordList.length, end));
    }
    return list.sort(() => Math.random() - 0.5); // 隨機打亂
}

// 進入下一題
function nextQuestion() {
    if (currentIndex >= testQueue.length) {
        alert(`🎉 恭喜完成本次訓練！您的得分是：${getPlayerRecord().score}`);
        location.reload(); // 訓練結束重整頁面
        return;
    }

    currentWord = testQueue[currentIndex];
    let mode = document.querySelector('input[name="gameMode"]:checked').value;
    
    // 更新介面與進度
    document.getElementById("nextBtn").style.display = "none";
    document.getElementById("feedbackMsg").innerText = "";
    document.getElementById("chineseHint").innerText = currentWord.chinese;
    
    let progressPercent = ((currentIndex) / testQueue.length) * 100;
    document.getElementById("progressBar").style.width = `${progressPercent}%`;
    document.getElementById("progressText").innerText = `進度: ${currentIndex + 1} / ${testQueue.length}`;

    // 處理例句挖空
    const sentenceHint = document.getElementById("sentenceHint");
    if (currentWord.sentence) {
        const cleanTarget = currentWord.english.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();
        const regex = new RegExp(cleanTarget, 'gi');
        sentenceHint.innerText = currentWord.sentence.replace(regex, "________");
    }

    if (mode === "spelling") {
        document.getElementById("spellingArea").style.display = "flex";
        document.getElementById("choiceArea").style.display = "none";
        document.getElementById("englishInput").disabled = false;
        document.getElementById("englishInput").value = "";
        document.getElementById("submitBtn").style.display = "inline-block";
        document.getElementById("englishInput").focus();
    } else {
        document.getElementById("spellingArea").style.display = "none";
        document.getElementById("choiceArea").style.display = "flex";
        renderChoiceOptions();
    }
}

// 渲染選擇題選項
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

// 檢查拼字答案
function checkAnswer() {
    const userInput = document.getElementById("englishInput").value.trim().toLowerCase();
    if (!userInput) return; 
    processResult(userInput, false);
}

// 檢查選擇題答案
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

// 處理計分與錯題本
function processResult(userInput, isChoiceMode) {
    const correctAnswer = currentWord.english.toLowerCase();
    let playerRecord = getPlayerRecord();
    let isCorrect = (userInput.toLowerCase() === correctAnswer);
    const feedback = document.getElementById("feedbackMsg");

    if (isCorrect) {
        feedback.innerText = "✨ 答對了！";
        feedback.className = "feedback correct";
        playerRecord.score += 10;
        if (playerRecord.mistakes[correctAnswer]) delete playerRecord.mistakes[correctAnswer];
    } else {
        feedback.innerText = `❌ 錯誤！正解: ${currentWord.english}`;
        feedback.className = "feedback wrong";
        playerRecord.mistakes[correctAnswer] = currentWord;
    }

    if (currentWord.sentence) document.getElementById("sentenceHint").innerText = currentWord.sentence;
    savePlayerRecord(playerRecord);
    updateScoreBoard();
    checkBossAvailable();

    if (!isChoiceMode) {
        document.getElementById("englishInput").disabled = true;
        document.getElementById("submitBtn").style.display = "none";
    }

    currentIndex++; // 推進度

    if (document.getElementById("autoNext").checked) {
        setTimeout(() => nextQuestion(), isCorrect ? 1500 : 3000);
    } else {
        document.getElementById("nextBtn").style.display = "inline-block";
    }
}

// 儲存與讀取資料 (LocalStorage)
function getPlayerRecord() {
    let data = localStorage.getItem(`SpHero_${currentPlayer}`);
    return data ? JSON.parse(data) : { score: 0, mistakes: {} };
}
function savePlayerRecord(data) { localStorage.setItem(`SpHero_${currentPlayer}`, JSON.stringify(data)); }
function updateScoreBoard() { document.getElementById("score").innerText = getPlayerRecord().score; }

// 魔王模式 (僅測試錯題)
function checkBossAvailable() {
    let mistakes = Object.keys(getPlayerRecord().mistakes).length;
    const bossBtn = document.getElementById("bossBtn");
    if (mistakes > 0 && document.getElementById("setupArea").style.display !== "none") {
        bossBtn.style.display = "block";
        bossBtn.innerText = `👿 挑戰魔王 (消除 ${mistakes} 個常錯單字)`;
    }
}
window.onload = checkBossAvailable; // 網頁載入時檢查

function startBossBattle() {
    currentPlayer = document.getElementById("playerName").value.trim() || "冒險王";
    testQueue = Object.values(getPlayerRecord().mistakes);
    isBossMode = true;
    currentIndex = 0;
    
    document.getElementById("setupArea").style.display = "none";
    document.getElementById("gameArea").style.display = "block";
    document.getElementById("progressContainer").style.display = "block";
    nextQuestion();
}

// 單字深度解析 (字根/同義/反義)
function showWordInfo() {
    document.getElementById("modalWordTitle").innerText = currentWord.english;
    document.getElementById("modalWordContent").innerHTML = `
        <p><b>📝 意思：</b> ${currentWord.chinese}</p>
        <p><b>🧬 字根字首：</b> <span style="color:#d35400;">${currentWord.roots || "暫無資料"}</span></p>
        <p><b>🔄 同義字：</b> ${currentWord.synonyms || "無"}</p>
        <p><b>↔️ 反義字：</b> ${currentWord.antonyms || "無"}</p>
        <p><b>⚠️ 易混淆：</b> <span style="color:#c0392b;">${currentWord.confused || "無"}</span></p>
    `;
    document.getElementById("infoModal").style.display = "flex";
}

// CSV 匯入擴充字庫功能
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const rows = e.target.result.split('\n');
        let count = 0;
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols.length >= 2) {
                wordList.push({
                    english: cols[0].replace(/"/g, '').trim(),
                    chinese: cols[1].replace(/"/g, '').trim(),
                    sentence: cols[2] ? cols[2].replace(/"/g, '').trim() : ""
                });
                count++;
            }
        }
        alert(`✅ 成功匯入 ${count} 個單字！目前總字數：${wordList.length}`);
    };
    reader.readAsText(file);
}

// 下載錯題本 CSV
function exportMistakes() {
    let mistakes = Object.values(getPlayerRecord().mistakes);
    if (mistakes.length === 0) { alert("🎉 目前沒有錯題紀錄！"); return; }
    let csv = "\uFEFF英文單字,中文意思,例句\n" + mistakes.map(w => `"${w.english}","${w.chinese}","${w.sentence || ''}"`).join("\n");
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `我的錯題本.csv`;
    link.click();
}

// Modal 控制
function openPromptModal() { document.getElementById("promptModal").style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
function copyPrompt() {
    const textElem = document.getElementById("aiPromptText");
    textElem.select();
    document.execCommand("copy");
    alert("✅ 提示詞已複製！請貼給 ChatGPT 或 Gemini 擴充字庫。");
}

function speakWord() {
    if (!currentWord || !currentWord.english) return;
    let utterance = new SpeechSynthesisUtterance(currentWord.english);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}

// 字典搜尋
function searchWord() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    const resultArea = document.getElementById("searchResultArea");
    if (!query) { resultArea.style.display = "none"; return; }
    
    const matches = wordList.filter(w => w.english.toLowerCase().includes(query) || (w.chinese && w.chinese.includes(query)));
    if (matches.length === 0) {
        resultArea.innerHTML = `<p style="color: red;">找不到相關單字。</p>`;
    } else {
        resultArea.innerHTML = matches.map(w => `
            <div style="background:#f1f2f6; padding:10px; margin-bottom:10px; border-radius:5px;">
                <h4 style="margin:0; color:#2c3e50;">${w.english} (${w.chinese})</h4>
                <p style="margin:5px 0 0 0; font-size:14px; color:#555;">${w.sentence || ""}</p>
            </div>
        `).join("");
    }
    resultArea.style.display = "block";
}
