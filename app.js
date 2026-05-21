/* ============================================================
 *  考研数学历年真题 — 主应用逻辑 (app.js)
 *  依赖: data_crawled.js (MATH_DB)
 *        Chart.js, chartjs-plugin-datalabels
 * ============================================================ */

// ─── 全局状态 ────────────────────────────────────────────────
let currentSubject = '8'; // '8' = 数学一, '9' = 数学二, '10' = 数学三
let chartInstance = null;
let questionIndexMap = {}; // O(1) map of questionId -> { question, paper }

// ─── 本地存储管理器 ──────────────────────────────────────────
const Storage = {
  getMoods() {
    try {
      return JSON.parse(localStorage.getItem('kaoyan_moods') || '{}');
    } catch (e) {
      return {};
    }
  },
  setMood(questionId, mood) {
    const moods = this.getMoods();
    if (mood) {
      moods[questionId] = mood;
    } else {
      delete moods[questionId];
    }
    localStorage.setItem('kaoyan_moods', JSON.stringify(moods));
  },
  getComments() {
    try {
      return JSON.parse(localStorage.getItem('kaoyan_comments') || '{}');
    } catch (e) {
      return {};
    }
  },
  addComment(questionId, content) {
    const comments = this.getComments();
    if (!comments[questionId]) comments[questionId] = [];
    comments[questionId].unshift({
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      author: '我',
      avatar: '😊',
      content: content,
      time: new Date().toLocaleString('zh-CN', { hour12: false })
    });
    localStorage.setItem('kaoyan_comments', JSON.stringify(comments));
    return comments[questionId];
  },
  deleteComment(questionId, commentId) {
    const comments = this.getComments();
    if (comments[questionId]) {
      comments[questionId] = comments[questionId].filter(c => c.id !== commentId);
      localStorage.setItem('kaoyan_comments', JSON.stringify(comments));
    }
    return comments[questionId] || [];
  },
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem('kaoyan_settings') || '{"numbers":false,"difficulty":false,"myRecords":false}');
    } catch (e) {
      return { numbers: false, difficulty: false, myRecords: false };
    }
  },
  setSetting(key, val) {
    const settings = this.getSettings();
    settings[key] = val;
    localStorage.setItem('kaoyan_settings', JSON.stringify(settings));
  }
};

// ─── 页面载入初始化 ──────────────────────────────────────────
function initApp() {
  // 1. 读取保存的主题/科目
  const savedSubject = localStorage.getItem('kaoyan_selected_subject');
  if (savedSubject && ['8', '9', '10'].includes(savedSubject)) {
    currentSubject = savedSubject;
  }
  $('#papergroupSelect').val(currentSubject);

  // 2. 绑定科目切换事件
  $('#papergroupSelect').on('change', function() {
    currentSubject = $(this).val();
    localStorage.setItem('kaoyan_selected_subject', currentSubject);
    loadSubjectData();
  });

  // 3. 读取并设置开关状态
  const settings = Storage.getSettings();
  $('#showQuestionNumbersSwitch').prop('checked', settings.numbers).on('change', function() {
    const checked = $(this).prop('checked');
    Storage.setSetting('numbers', checked);
    toggleQuestionNumbers(checked);
  });

  $('#showDifficultySwitch').prop('checked', settings.difficulty).on('change', function() {
    const checked = $(this).prop('checked');
    Storage.setSetting('difficulty', checked);
    toggleDifficulty(checked);
  });

  $('#showMyRecordsSwitch').prop('checked', settings.myRecords).on('change', function() {
    const checked = $(this).prop('checked');
    Storage.setSetting('myRecords', checked);
    toggleMyRecords(checked);
  });

  // 4. 加载当前科目数据
  loadSubjectData();

  // 5. 显示网站公告
  showAnnouncement();
}

// ─── 加载指定科目的所有数据 ──────────────────────────────────
function loadSubjectData() {
  const db = MATH_DB[currentSubject];
  if (!db) {
    console.error('未找到对应科目数据:', currentSubject);
    return;
  }

  // 1. 建立题目 O(1) 检索映射
  questionIndexMap = {};
  db.papers.forEach(paper => {
    paper.questions.forEach(q => {
      questionIndexMap[q.id] = { question: q, paper: paper };
    });
  });

  // 2. 渲染侧边栏考点树
  renderKnowledgeTree(db.knowledge_tree);

  // 3. 渲染真题墙
  renderPaperGrid(db.papers);

  // 4. 渲染统计图表
  renderChart(db.knowledge_tree, db.papers);

  // 5. 应用各种开关状态的UI表现
  const settings = Storage.getSettings();
  toggleQuestionNumbers(settings.numbers);
  toggleDifficulty(settings.difficulty);
  toggleMyRecords(settings.myRecords);
}

// ─── 1. 考点树渲染 ──────────────────────────────────────────
function renderKnowledgeTree(tree) {
  const $container = $('#knowledgeTreeContent');
  if (!$container.length) return;

  $container.empty();

  let html = '<ul class="list-unstyled mb-0">';
  tree.forEach((level1, idx1) => {
    const l1Leafs = JSON.stringify(getLeafIds(level1));
    html += `
      <li class="mb-3">
        <div class="d-flex justify-content-between align-items-center py-2 px-3 fw-bold text-dark cursor-pointer border-bottom" data-bs-toggle="collapse" data-bs-target="#l1-collapse-${idx1}" onclick='handleLevelClick(this, ${l1Leafs})'>
          <span style="font-size: 1.05rem;">${level1.name}</span>
        </div>
        <div class="collapse show" id="l1-collapse-${idx1}">
          <ul class="list-unstyled ps-2 mt-2">
    `;

    if (level1.children && level1.children.length > 0) {
      level1.children.forEach((level2, idx2) => {
        const uniqueId = `l2-collapse-${idx1}-${idx2}`;
        const l2Leafs = JSON.stringify(getLeafIds(level2));
        html += `
          <li class="mb-2">
            <div class="d-flex justify-content-between align-items-center py-1 px-2 fw-semibold text-secondary cursor-pointer rounded" data-bs-toggle="collapse" data-bs-target="#${uniqueId}" onclick='handleLevelClick(this, ${l2Leafs})' onmouseover="this.style.backgroundColor='#f0f2f5'" onmouseout="this.style.backgroundColor='transparent'">
              <span style="font-size: 0.95rem;">${level2.name}</span>
            </div>
            <div class="collapse show" id="${uniqueId}">
              <ul class="list-unstyled ps-3 mt-1">
        `;

        if (level2.children && level2.children.length > 0) {
          level2.children.forEach((level3) => {
            html += `
              <li>
                <div class="py-1 px-2 rounded cursor-pointer text-muted d-flex justify-content-between align-items-center knowledge-item" data-knowledge-id="${level3.id}" onclick="handleKnowledgeItemClick(this, ${level3.id}, '${level3.name.replace(/'/g, "\\'")}')" onmouseover="this.style.color='#1890ff'" onmouseout="this.style.color='inherit'">
                  <span class="knowledge-name small">${level3.name}</span>
                </div>
              </li>
            `;
          });
        }

        html += `
              </ul>
            </div>
          </li>
        `;
      });
    }

    html += `
          </ul>
        </div>
      </li>
    `;
  });
  html += '</ul>';

  $container.html(html);
}

// 点击二级考点时的处理
window.handleKnowledgeItemClick = function(elem, id, name) {
  const $elem = $(elem);
  const isActive = $elem.hasClass('active');

  // 清除其他考点的高亮
  $('.knowledge-item').removeClass('active').find('.knowledge-study-btn').remove();
  $('.knowledge-level-active').removeClass('knowledge-level-active text-primary').find('.knowledge-study-btn').remove();

  if (isActive) {
    window.highlightQuestionsByLeafIds([]);
    return;
  }

  $elem.addClass('active');

  // 添加"刷题"按钮
  const $studyBtn = $(`
    <button class="btn btn-primary btn-sm py-0 px-2 knowledge-study-btn" 
            style="font-size: 11px; margin-left: 5px;" 
            onclick="event.stopPropagation(); showQuestionModal([${id}], '${name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
      刷题
    </button>
  `);
  $elem.append($studyBtn);

  // 在真题墙中高亮包含此知识点的题
  window.highlightQuestionsByLeafIds([id]);
};

window.handleLevelClick = function(elem, leafIds) {
  const $elem = $(elem);
  const isActive = $elem.hasClass('knowledge-level-active');

  // 清除其他考点的高亮
  $('.knowledge-item').removeClass('active').find('.knowledge-study-btn').remove();
  $('.knowledge-level-active').removeClass('knowledge-level-active text-primary').find('.knowledge-study-btn').remove();
  
  if (isActive) {
    window.highlightQuestionsByLeafIds([]);
    return;
  }

  $elem.addClass('knowledge-level-active text-primary');
  
  // 添加"刷题"按钮
  const name = $elem.text().trim();
  const leafIdsJson = JSON.stringify(leafIds);
  const safeName = name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
  const $studyBtn = $(`
    <button class="btn btn-primary btn-sm py-0 px-2 knowledge-study-btn" 
            style="font-size: 11px; margin-left: auto;" 
            onclick="event.stopPropagation(); showQuestionModal(${leafIdsJson}, '${safeName}')">
      刷题
    </button>
  `);
  $elem.append($studyBtn);
  
  // 在真题墙中高亮包含此大标题下所有知识点的题
  window.highlightQuestionsByLeafIds(leafIds);
};

// ─── 2. 渲染真题墙 ──────────────────────────────────────────
function renderPaperGrid(papers) {
  const $container = $('#paperListContent');
  if (!$container.length) return;

  $container.empty();

  // 按年份降序排序
  const sortedPapers = [...papers].sort((a, b) => b.name.localeCompare(a.name));

  const $row = $('<div class="row flex-nowrap" style="overflow-x: auto; overflow-y: visible; min-height: 500px; padding-bottom: 15px;"></div>');

  sortedPapers.forEach(paper => {
    const $col = $(`
      <div class="col-md-t mb-3 paper-column" data-paper-id="${paper.id}">
        <div class="card h-100 bg-dark text-white border-secondary" style="border-radius: 8px;">
          <div class="paper-header py-2 px-1 border-bottom border-secondary text-center" 
               data-paper-id="${paper.id}" data-paper-name="${paper.name}" 
               style="cursor: pointer; background-color: rgba(255,255,255,0.05); border-top-left-radius: 8px; border-top-right-radius: 8px;"
               onclick="showPaperModal(${paper.id}, '${paper.name.replace(/'/g, "\\'")}')">
            <h6 class="card-title mb-0 small fw-bold text-light">${paper.name}</h6>
          </div>
          <div class="card-body p-1 d-flex flex-column gap-1 paper-column-body">
            <!-- 题目列表 -->
          </div>
        </div>
      </div>
    `);

    const $body = $col.find('.paper-column-body');

    paper.questions.forEach((q, idx) => {
      const idx1 = q.index || (idx + 1);
      const thumbUrl = `/static/photos/group_${currentSubject}/paper_${paper.id}/${idx1}_thumb.png`;

      const $item = $(`
        <div class="mb-0 position-relative question-item border rounded bg-white p-0 text-center"
             data-knowledge-id="${q.knowledge_tags_id || ''}"
             data-paper-name="${paper.name}"
             data-question-number="${idx1}"
             data-question-id="${q.id}"
             data-question-type="${q.question_type || 1}"
             data-score="${q.score || 0}"
             data-year="${q.year || ''}"
             data-happy-count="${q.happy_count || 0}"
             data-maybe-count="${q.maybe_count || 0}"
             data-sad-count="${q.sad_count || 0}"
             style="cursor: pointer; min-height: 40px; border-color: #dee2e6 !important;"
             onclick="handleQuestionItemClick(this)">
          <img src="${thumbUrl}"
               alt="题目 ${idx1}"
               class="img-fluid w-100"
               loading="lazy"
               onerror="window.fallbackThumbImage(this)"
               style="max-height: 80px; object-fit: contain;">
          <div class="mb-1 fallback-btn-container" style="display: none;">
            <button class="btn btn-outline-secondary btn-sm w-100 p-1" style="font-size: 11px;">
              第 ${idx1} 题
            </button>
          </div>
          <div class="question-overlay" style="display: none;"></div>
        </div>
      `);

      $body.append($item);
    });

    $row.append($col);
  });

  $container.append($row);
}

// ─── 3. 真题墙高亮题目处理 ──────────────────────────────────
window.highlightQuestionsByLeafIds = function(leafIds) {
  $('.question-item').removeClass('highlighted');
  $('.question-item .question-overlay').hide();

  let $firstMatch = null;
  leafIds.forEach(id => {
    const $matches = $(`.question-item[data-knowledge-id="${id}"]`);
    if ($matches.length > 0) {
      $matches.addClass('highlighted');
      $matches.find('.question-overlay').show().css({
        'background-color': 'rgba(24, 144, 255, 0.15)',
        'border': '2px solid #1890ff',
        'display': 'block'
      });
      if (!$firstMatch) $firstMatch = $matches.first();
    }
  });

  if ($firstMatch) {
    $firstMatch[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
};

// ─── 4. 统计图表渲染 (Chart.js) ─────────────────────────────
function renderChart(tree, papers) {
  const ctx = document.getElementById('paperGroupChart');
  if (!ctx) return;

  // 提取所有二级考点
  const level2Nodes = [];
  tree.forEach(l1 => {
    if (l1.children) {
      l1.children.forEach(l2 => {
        level2Nodes.push(l2);
      });
    }
  });

  const labels = [];
  const totalScores = [];
  const proficientScores = [];
  const unfamiliarScores = [];
  const unknownScores = [];

  const moods = Storage.getMoods();

  level2Nodes.forEach(node => {
    const leafIds = getLeafIds(node);
    
    let totalScore = 0;
    let profScore = 0;
    let unfamScore = 0;
    let unkScore = 0;

    papers.forEach(paper => {
      paper.questions.forEach(q => {
        if (leafIds.includes(q.knowledge_tags_id)) {
          const score = q.score || 0;
          totalScore += score;

          const mood = moods[q.id];
          if (mood === 'happy') {
            profScore += score;
          } else if (mood === 'maybe') {
            unfamScore += score;
          } else if (mood === 'sad') {
            unkScore += score;
          }
        }
      });
    });

    if (totalScore > 0) {
      labels.push(node.name);
      totalScores.push(totalScore);
      proficientScores.push(profScore);
      unfamiliarScores.push(unfamScore);
      unknownScores.push(unkScore);
    }
  });

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const datasets = [
    {
      label: '总分值',
      data: totalScores,
      backgroundColor: 'rgba(54, 162, 235, 0.4)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
      yAxisID: 'y',
      stack: 'total'
    },
    {
      label: '熟练',
      data: proficientScores,
      backgroundColor: '#28a745',
      borderColor: '#28a745',
      borderWidth: 1,
      yAxisID: 'y',
      stack: 'user'
    },
    {
      label: '不熟',
      data: unfamiliarScores,
      backgroundColor: '#ffc107',
      borderColor: '#ffc107',
      borderWidth: 1,
      yAxisID: 'y',
      stack: 'user'
    },
    {
      label: '不会',
      data: unknownScores,
      backgroundColor: '#dc3545',
      borderColor: '#dc3545',
      borderWidth: 1,
      yAxisID: 'y',
      stack: 'user'
    }
  ];

  const totalSum = totalScores.reduce((a, b) => a + b, 0);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    plugins: [ChartDataLabels],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#fff'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw}分`;
            }
          }
        },
        datalabels: {
          display: function(context) {
            return context.datasetIndex === 0;
          },
          anchor: 'end',
          align: 'top',
          color: '#fff',
          font: {
            size: 10
          },
          formatter: function(value) {
            const percentage = totalSum > 0 ? ((value / totalSum) * 100).toFixed(1) : 0;
            return `${value}分 (${percentage}%)`;
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#fff',
            font: {
              size: 10
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#fff'
          },
          stacked: true
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const clickedLabel = labels[index];
          highlightLevel2NodeByName(clickedLabel);
        }
      }
    }
  });
}

function highlightLevel2NodeByName(name) {
  const $tree = $('#knowledgeTreeContent');
  const $header = $tree.find(`.knowledge-group-header:contains("${name}")`);
  if ($header.length) {
    const collapseId = $header.attr('data-bs-target') || '';
    if (collapseId) {
      $(collapseId).collapse('show');
    }
    $header[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    $header.addClass('bg-primary').delay(1500).queue(function(next) {
      $(this).removeClass('bg-primary');
      next();
    });

    const $firstL3 = $header.next('.collapse').find('.knowledge-item').first();
    if ($firstL3.length) {
      $firstL3.trigger('click');
    }
  }
}

// 获取子节点ID辅助函数
function getLeafIds(node) {
  let ids = [];
  if (!node.children || node.children.length === 0) {
    ids.push(node.id);
  } else {
    node.children.forEach(child => {
      ids = ids.concat(getLeafIds(child));
    });
  }
  return ids;
}

// ─── 5. 试卷模态框与单题模态框 ──────────────────────────────
window.showPaperModal = function(paperId, paperName) {
  const db = MATH_DB[currentSubject];
  const paper = db.papers.find(p => p.id === paperId);
  if (!paper) return;

  $('#paperModalTitle').text(`${paperName} 年真题试卷`);
  const $body = $('#paperModalBody');
  $body.empty();

  paper.questions.forEach(q => {
    const qData = {
      ...q,
      image_url: `/static/photos/group_${currentSubject}/paper_${paper.id}/${q.index}.png`
    };
    const card = createQuestionCard(qData, 'paper');
    $body.append(card);
  });

  $('#paperModal').modal('show');
};

window.handleQuestionItemClick = function(elem) {
  const questionId = $(elem).attr('data-question-id');
  const paperName = $(elem).attr('data-paper-name');
  const questionNum = $(elem).attr('data-question-number');
  
  const mapped = questionIndexMap[questionId];
  if (!mapped) return;

  const q = mapped.question;
  const paper = mapped.paper;

  $('#questionModal .modal-title').text(`${paperName} 第${questionNum}题`);
  
  const qData = {
    ...q,
    image_url: `/static/photos/group_${currentSubject}/paper_${paper.id}/${q.index}.png`
  };

  const card = createQuestionCard(qData, 'single');
  $('#questionModalContent').html(card);
  $('#questionModal').modal('show');
};

// ─── 6. 知识点刷题模态框 ────────────────────────────────────
window.showQuestionModal = function(knowledgeIds, knowledgeName) {
  const idsArray = Array.isArray(knowledgeIds) ? knowledgeIds : [knowledgeIds];
  const db = MATH_DB[currentSubject];
  const matchingQuestions = [];
  db.papers.forEach(paper => {
    paper.questions.forEach(q => {
      if (idsArray.includes(q.knowledge_tags_id)) {
        matchingQuestions.push({
          ...q,
          paper_id: paper.id,
          paper_name: paper.name
        });
      }
    });
  });

  matchingQuestions.sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    if (yearA !== yearB) return yearB - yearA;
    return a.index - b.index;
  });

  const $modal = $('#questionModal');
  $modal.find('.modal-title').text(`${knowledgeName} - 专题刷题`);

  const $content = $('#questionModalContent');
  $content.empty();

  if (matchingQuestions.length === 0) {
    $content.html('<div class="text-center text-muted py-5">暂无真题收录</div>');
    $modal.modal('show');
    return;
  }

  const questionsPerPage = 10;
  const totalQuestions = matchingQuestions.length;
  const totalPages = Math.ceil(totalQuestions / questionsPerPage);
  let currentPage = 1;

  const $questionsContainer = $('<div class="row"></div>');
  $content.append($questionsContainer);

  let $paginationContainer = null;
  if (totalQuestions > questionsPerPage) {
    $paginationContainer = $('<div class="pagination-container mt-4 d-flex justify-content-center"></div>');
    $content.append($paginationContainer);
  }

  function renderPage(page) {
    $questionsContainer.empty();
    const startIndex = (page - 1) * questionsPerPage;
    const endIndex = Math.min(startIndex + questionsPerPage, totalQuestions);

    for (let i = startIndex; i < endIndex; i++) {
      const q = matchingQuestions[i];
      const qData = {
        ...q,
        image_url: `/static/photos/group_${currentSubject}/paper_${q.paper_id}/${q.index}.png`
      };

      const card = createQuestionCard(qData, 'knowledge');
      const $col = $('<div class="col-12 mb-3"></div>').append(card);
      
      const seq = i + 1;
      const $seqLabel = $(`
        <div class="sequence-number" style="
            position: absolute;
            top: 10px;
            left: 20px;
            background-color: rgba(187, 187, 187, 0.85);
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            z-index: 10;
        ">${seq} / ${totalQuestions}</div>
      `);
      $col.css('position', 'relative').append($seqLabel);
      $questionsContainer.append($col);
    }

    if ($paginationContainer) {
      $paginationContainer.empty();
      const $ul = $('<ul class="pagination pagination-sm mb-0"></ul>');
      
      const $prev = $(`<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)">上一页</a></li>`);
      $prev.on('click', () => { if (page > 1) { currentPage--; renderPage(currentPage); } });
      $ul.append($prev);

      for (let p = 1; p <= totalPages; p++) {
        const $li = $(`<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="javascript:void(0)">${p}</a></li>`);
        $li.on('click', () => { currentPage = p; renderPage(p); });
        $ul.append($li);
      }

      const $next = $(`<li class="page-item ${page === totalPages ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)">下一页</a></li>`);
      $next.on('click', () => { if (page < totalPages) { currentPage++; renderPage(currentPage); } });
      $ul.append($next);

      $paginationContainer.append($ul);
    }

    const settings = Storage.getSettings();
    toggleQuestionNumbers(settings.numbers);
    toggleMyRecords(settings.myRecords);
    
    $content.scrollTop(0);
  }

  renderPage(currentPage);
  $modal.modal('show');
};

// 举一反三跳转
window.showSimilarQuestions = function(tagsId, pointName) {
  $('#paperModal').modal('hide');
  $('#questionModal').modal('hide');
  setTimeout(() => {
    showQuestionModal(tagsId, pointName);
  }, 350);
};

// ─── 7. 创建题目卡片 ────────────────────────────────────────
function createQuestionCard(q, mode = 'knowledge') {
  const temp = document.getElementById('questionCardTemplate');
  if (!temp) return null;

  const clone = temp.content.cloneNode(true);
  const $card = $(clone).find('.question-card');
  const questionId = q.id;

  $card.attr('data-question-id', questionId);
  $card.attr('data-knowledge-id', q.knowledge_tags_id || '');
  $card.attr('data-happy-count', q.happy_count || 0);
  $card.attr('data-maybe-count', q.maybe_count || 0);
  $card.attr('data-sad-count', q.sad_count || 0);

  // 题目图片
  $card.find('.question-image').attr({
    'src': q.image_url,
    'alt': `题目图片`
  });

  // 头栏信息
  $card.find('.question-year').text(q.year + '年');
  $card.find('.question-score').text(q.score || 0);
  $card.find('.question-idx-label').text(q.index || '?');

  const $kpName = $card.find('.knowledge-point-name');
  if (mode === 'knowledge') {
    $kpName.hide();
  } else if (q.knowledge_point_name) {
    $kpName.text(q.knowledge_point_name + ' →').show();
    $kpName.on('click', () => {
      showSimilarQuestions(q.knowledge_tags_id, q.knowledge_point_name);
    });
  } else {
    $kpName.hide();
  }

  if (mode === 'paper') {
    $card.find('.question-year').hide();
    $card.find('.year-separator').hide();
  }

  // 答案展开折叠
  const $ansDisplay = $card.find('.answer-display');
  const $ansContent = $card.find('.answer-content');
  $card.find('.answer-btn').on('click', function() {
    if ($ansDisplay.is(':visible')) {
      $ansDisplay.slideUp(200);
    } else {
      if (q.is_multiple_choice || q.question_type === 1) {
        $ansContent.html(`
          <div class="d-flex align-items-center py-2">
            <span class="badge bg-success-lt me-3 px-3 py-2" style="font-size: 14px;">答案</span>
            <span style="font-size: 20px; font-weight: bold;" class="text-success">${q.answer || '未知'}</span>
          </div>
        `);
      } else {
        const ansImgPath = `/static/photos/answer_images/${questionId}.png`;
        $ansContent.html(`
          <div class="py-2 text-center">
            <img src="${ansImgPath}" alt="答案图片" class="img-fluid border rounded bg-white p-1" onerror="window.fallbackAnswerImage(this)">
          </div>
        `);
      }
      $ansDisplay.slideDown(200);
    }
  });

  // 解析展开折叠
  const $anaDisplay = $card.find('.analysis-display');
  const $anaContent = $card.find('.analysis-content');
  $card.find('.analysis-btn').on('click', function() {
    if ($anaDisplay.is(':visible')) {
      $anaDisplay.slideUp(200);
    } else {
      const anaImgPath = `/static/photos/analysis_images/${questionId}.png`;
      $anaContent.html(`
        <div class="py-2 text-center">
          <img src="${anaImgPath}" alt="解析图片" class="img-fluid border rounded bg-white p-1" onerror="window.fallbackAnalysisImage(this)">
        </div>
      `);
      $anaDisplay.slideDown(200);
    }
  });

  // 视频讲解展开折叠
  const $vidDisplay = $card.find('.video-display');
  const $vidContent = $card.find('.video-content');
  $card.find('.video-btn').on('click', function() {
    if ($vidDisplay.is(':visible')) {
      $vidDisplay.slideUp(200);
    } else {
      if (q.video_url) {
        $vidContent.html(`
          <div class="alert alert-info py-2 px-3 mb-2 small text-secondary">
            💡 <strong>点击下方链接可跳转播放。</strong> 在平板上如果安装了B站App，若无法自动跳转时间点，请长按并在“后台打开”，或手动复制链接在浏览器中粘贴播放。
          </div>
          <div class="list-group">
            <a href="${q.video_url}" onclick="window.openVideo(this.href); return false;" class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-2">
              <div class="d-flex align-items-center">
                <span class="me-2 text-primary">▶</span>
                <span class="small fw-semibold">2009-2025真题精讲 (${q.year}年 第${q.index}题)</span>
              </div>
              <span class="badge bg-primary-lt">B站视频</span>
            </a>
          </div>
        `);
      } else {
        $vidContent.html('<p class="text-muted small py-2">暂无讲解视频</p>');
      }
      $vidDisplay.slideDown(200);
    }
  });

  // 掌握度展开折叠
  const $statsDisplay = $card.find('.stats-panel');
  $card.find('.stats-btn').on('click', function() {
    if ($statsDisplay.is(':visible')) {
      $statsDisplay.slideUp(200);
    } else {
      const happy = parseInt(q.happy_count) || 0;
      const maybe = parseInt(q.maybe_count) || 0;
      const sad = parseInt(q.sad_count) || 0;
      const total = happy + maybe + sad;

      let happyPct = 0, maybePct = 0, sadPct = 0;
      if (total > 0) {
        happyPct = ((happy / total) * 100).toFixed(1);
        maybePct = ((maybe / total) * 100).toFixed(1);
        sadPct = ((sad / total) * 100).toFixed(1);
      }

      $statsDisplay.find('.stats-happy-bar').css('width', happyPct + '%').attr('title', `熟练: ${happyPct}%`);
      $statsDisplay.find('.stats-maybe-bar').css('width', maybePct + '%').attr('title', `不熟: ${maybePct}%`);
      $statsDisplay.find('.stats-sad-bar').css('width', sadPct + '%').attr('title', `不会: ${sadPct}%`);

      $statsDisplay.find('.stats-happy-percent').text(happyPct + '%');
      $statsDisplay.find('.stats-maybe-percent').text(maybePct + '%');
      $statsDisplay.find('.stats-sad-percent').text(sadPct + '%');

      $statsDisplay.find('.stats-happy-num').text(happy);
      $statsDisplay.find('.stats-maybe-num').text(maybe);
      $statsDisplay.find('.stats-sad-num').text(sad);

      $statsDisplay.slideDown(200);
    }
  });

  $card.find('.close-stats-btn').on('click', function() {
    $statsDisplay.slideUp(200);
  });

  // 评论/笔记展开折叠
  const $commDisplay = $card.find('.comment-section');
  $card.find('.comment-btn').on('click', function() {
    if ($commDisplay.is(':visible')) {
      $commDisplay.slideUp(200);
    } else {
      renderCommentList($card, questionId);
      $commDisplay.slideDown(200);
    }
  });

  $card.find('.close-comment-btn').on('click', function() {
    $commDisplay.slideUp(200);
  });

  const $input = $card.find('.comment-input');
  $input.on('input', function() {
    const len = $(this).val().length;
    $card.find('.char-count').text(`${len}/500`);
  });

  $card.find('.submit-comment-btn').on('click', function() {
    const content = $input.val().trim();
    if (!content) {
      showToast('请输入笔记或评论内容！', 'warning');
      return;
    }
    Storage.addComment(questionId, content);
    $input.val('');
    $card.find('.char-count').text('0/500');
    renderCommentList($card, questionId);
    showToast('发表成功！', 'success');
  });

  const $filterSwitch = $card.find('.show-only-my-comments');
  $filterSwitch.on('change', function() {
    renderCommentList($card, questionId);
  });

  // 表情掌握度选择绑定
  $card.find('.mood-happy').on('click', () => handleMoodVote(questionId, 'happy'));
  $card.find('.mood-maybe').on('click', () => handleMoodVote(questionId, 'maybe'));
  $card.find('.mood-sad').on('click', () => handleMoodVote(questionId, 'sad'));

  // 初始化表情UI与评论计数
  updateCardMoodUI($card, questionId);
  updateCardCommentCount($card, questionId);

  return $card;
}

// ─── 8. 表情掌握度与评论逻辑 ────────────────────────────────
function handleMoodVote(questionId, moodType) {
  const moods = Storage.getMoods();
  const currentMood = moods[questionId];

  let newMood = moodType;
  if (currentMood === moodType) {
    newMood = null;
  }

  Storage.setMood(questionId, newMood);

  // 同步所有卡片UI
  const $cards = $(`.question-card[data-question-id="${questionId}"]`);
  $cards.each(function() {
    updateCardMoodUI($(this), questionId);
  });

  // 同步更新真题墙蒙版
  const settings = Storage.getSettings();
  if (settings.myRecords) {
    applyMoodOverlays();
  }

  // 同步更新图表
  const db = MATH_DB[currentSubject];
  renderChart(db.knowledge_tree, db.papers);

  showToast(newMood ? '掌握状态已成功更新！' : '掌握状态已清除！', 'success');
}

function updateCardMoodUI($card, questionId) {
  const moods = Storage.getMoods();
  const userMood = moods[questionId];

  const $happy = $card.find('.mood-happy');
  const $maybe = $card.find('.mood-maybe');
  const $sad = $card.find('.mood-sad');

  $happy.removeClass('btn-success text-white').addClass('btn-ghost-success');
  $maybe.removeClass('btn-warning text-white').addClass('btn-ghost-warning');
  $sad.removeClass('btn-danger text-white').addClass('btn-ghost-danger');

  if (userMood === 'happy') {
    $happy.removeClass('btn-ghost-success').addClass('btn-success text-white');
  } else if (userMood === 'maybe') {
    $maybe.removeClass('btn-ghost-warning').addClass('btn-warning text-white');
  } else if (userMood === 'sad') {
    $sad.removeClass('btn-ghost-danger').addClass('btn-danger text-white');
  }

  const baseHappy = parseInt($card.attr('data-happy-count')) || 0;
  const baseMaybe = parseInt($card.attr('data-maybe-count')) || 0;
  const baseSad = parseInt($card.attr('data-sad-count')) || 0;

  const happyCount = baseHappy + (userMood === 'happy' ? 1 : 0);
  const maybeCount = baseMaybe + (userMood === 'maybe' ? 1 : 0);
  const sadCount = baseSad + (userMood === 'sad' ? 1 : 0);

  $card.find('.mood-happy-count').text(happyCount);
  $card.find('.mood-maybe-count').text(maybeCount);
  $card.find('.mood-sad-count').text(sadCount);
}

// 模拟学长姐评论数据库
function getMockComments(questionId) {
  const mapped = questionIndexMap[questionId];
  if (!mapped) return [];
  const q = mapped.question;
  const kpName = q.knowledge_point_name || '该考点';
  
  return [
    {
      id: 'mock-1-' + questionId,
      author: '高分学姐',
      avatar: '🎓',
      content: `这道题考查的是“${kpName}”。解题的核心在于仔细审题，尤其要关注隐含边界条件，不要直接套用公式。`,
      time: '2025-10-12 14:32:00',
      is_mock: true
    },
    {
      id: 'mock-2-' + questionId,
      author: '考研AI助手',
      avatar: '🤖',
      content: `对于这道 ${q.score} 分的分值题，在考研大纲中属于重点题型。建议先把讲题视频看完，再自己完整演算一遍。`,
      time: '2025-11-03 09:15:00',
      is_mock: true
    }
  ];
}

function renderCommentList($card, questionId) {
  const $list = $card.find('.comment-list');
  if (!$list.length) return;

  const userComments = Storage.getComments()[questionId] || [];
  const mockComments = getMockComments(questionId);
  const showOnlyMy = $card.find('.show-only-my-comments').prop('checked');

  let allComments = [];
  if (showOnlyMy) {
    allComments = userComments;
  } else {
    allComments = userComments.concat(mockComments);
  }

  if (allComments.length === 0) {
    $list.html('<div class="text-center text-muted py-3 small">暂无笔记或评论</div>');
    return;
  }

  let html = '';
  allComments.forEach(comment => {
    html += `
      <div class="comment-item border-bottom py-2" data-comment-id="${comment.id}">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="d-flex align-items-center gap-2">
            <span class="avatar avatar-xs rounded-circle bg-light" style="width: 20px; height: 20px; font-size: 11px;">${comment.avatar}</span>
            <span class="fw-bold small text-secondary">${comment.author}</span>
            ${comment.is_mock ? '<span class="badge bg-blue-lt" style="font-size: 9px;">考点指导</span>' : '<span class="badge bg-green-lt" style="font-size: 9px;">我的笔记</span>'}
          </div>
          <div class="text-muted" style="font-size: 10px;">${comment.time}</div>
        </div>
        <div class="text-dark small ps-4" style="white-space: pre-wrap; font-size: 12px;">${comment.content}</div>
        ${comment.author === '我' ? `
          <div class="text-end">
            <a href="javascript:void(0)" class="text-danger small delete-comment-btn" style="font-size: 11px;" onclick="window.deleteUserComment('${questionId}', '${comment.id}')">删除</a>
          </div>
        ` : ''}
      </div>
    `;
  });

  $list.html(html);
  updateCardCommentCount($card, questionId);
}

window.deleteUserComment = function(questionId, commentId) {
  if (confirm('确定要删除您的这篇刷题笔记吗？')) {
    Storage.deleteComment(questionId, commentId);
    const $cards = $(`.question-card[data-question-id="${questionId}"]`);
    $cards.each(function() {
      renderCommentList($(this), questionId);
    });
    showToast('删除成功', 'success');
  }
};

function updateCardCommentCount($card, questionId) {
  const userComments = Storage.getComments()[questionId] || [];
  const mockComments = getMockComments(questionId);
  const total = userComments.length + mockComments.length;

  const $badge = $card.find('.comment-count');
  if ($badge.length) {
    $badge.text(total);
    $badge.css('display', total > 0 ? 'inline' : 'none');
  }
}

// ─── 9. 开关切换样式呈现 ───────────────────────────────────
function toggleQuestionNumbers(checked) {
  $('.question-item').each(function() {
    const $item = $(this);
    $item.find('.question-number').remove();
    if (checked) {
      const num = $item.attr('data-question-number') || '?';
      const $lbl = $(`<div class="question-number" style="
        position: absolute;
        bottom: 2px;
        right: 2px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        z-index: 6;
        display: flex !important;
      ">${num}</div>`);
      $item.append($lbl);
    }
  });
}

function toggleDifficulty(checked) {
  $('.question-item').each(function() {
    const $item = $(this);
    $item.find('.difficulty-overlay').remove();
    if (checked) {
      const happy = parseInt($item.attr('data-happy-count')) || 0;
      const maybe = parseInt($item.attr('data-maybe-count')) || 0;
      const sad = parseInt($item.attr('data-sad-count')) || 0;
      const total = happy + maybe + sad;

      let happyPct = 0, maybePct = 0, sadPct = 0;
      if (total > 0) {
        happyPct = (happy / total * 100).toFixed(1);
        maybePct = (maybe / total * 100).toFixed(1);
        sadPct = (sad / total * 100).toFixed(1);
      } else {
        happyPct = 100;
      }

      const $overlay = $(`
        <div class="difficulty-overlay" style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          pointer-events: none;
          z-index: 5;
          opacity: 0.35;
          border-radius: 4px;
          overflow: hidden;
        ">
          <div class="difficulty-segment difficulty-happy" style="width: ${happyPct}%; background-color: #28a745; height: 100%;"></div>
          <div class="difficulty-segment difficulty-maybe" style="width: ${maybePct}%; background-color: #ffc107; height: 100%;"></div>
          <div class="difficulty-segment difficulty-sad" style="width: ${sadPct}%; background-color: #dc3545; height: 100%;"></div>
        </div>
      `);
      $item.append($overlay);
    }
  });
}

function toggleMyRecords(checked) {
  if (checked) {
    applyMoodOverlays();
  } else {
    $('.question-item .mood-overlay').remove();
  }
}

function applyMoodOverlays() {
  const moods = Storage.getMoods();
  $('.question-item').each(function() {
    const $item = $(this);
    const questionId = $item.attr('data-question-id');
    $item.find('.mood-overlay').remove();

    const mood = moods[questionId];
    if (mood) {
      const $overlay = $(`<div class="mood-overlay ${mood}" style="
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: ${mood === 'happy' ? 'rgba(40, 167, 69, 0.45)' : mood === 'maybe' ? 'rgba(255, 193, 7, 0.45)' : 'rgba(220, 53, 69, 0.45)'};
        pointer-events: none;
        z-index: 5;
        border-radius: 4px;
      "></div>`);
      $item.append($overlay);
    }
  });
}

// ─── 10. 全局图片加载错误回调兜底 ─────────────────────────────
window.fallbackThumbImage = function(img) {
  if (!img.dataset.triedFallback) {
    img.dataset.triedFallback = true;
    const src = img.getAttribute('src');
    if (src) {
      img.src = 'https://zhentiqiang.com' + src;
    }
  } else {
    img.style.display = 'none';
    const next = img.nextElementSibling;
    if (next && next.classList.contains('fallback-btn-container')) {
      next.style.display = 'block';
    }
  }
};

window.fallbackQuestionImage = function(img) {
  if (!img.dataset.triedFallback) {
    img.dataset.triedFallback = true;
    const src = img.getAttribute('src');
    if (src) {
      img.src = 'https://zhentiqiang.com' + src;
    }
  } else {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      const placeholder = document.createElement('div');
      placeholder.className = 'py-4 text-muted bg-light text-center small border rounded';
      placeholder.innerText = '图片加载失败';
      parent.appendChild(placeholder);
    }
  }
};

window.fallbackAnswerImage = function(img) {
  if (!img.dataset.triedFallback) {
    img.dataset.triedFallback = true;
    img.src = 'https://zhentiqiang.com' + img.getAttribute('src');
  } else {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      parent.innerHTML = '<span class="text-muted small">暂无答案图片</span>';
    }
  }
};

window.fallbackAnalysisImage = function(img) {
  if (!img.dataset.triedFallback) {
    img.dataset.triedFallback = true;
    img.src = 'https://zhentiqiang.com' + img.getAttribute('src');
  } else {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      parent.innerHTML = '<span class="text-muted small">该题暂无解析图片</span>';
    }
  }
};

// ─── 11. 视频与公告、吐司处理 ──────────────────────────────
window.openVideo = function(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('视频链接已复制到剪贴板，正在打开视频...', 'success');
  }).catch(() => {
    showToast('正在打开视频...', 'info');
  });
  window.open(url, '_blank');
};

window.showAnnouncement = function() {
  const modalBody = document.getElementById('featureInfoModalBody');
  if (modalBody) {
    modalBody.innerHTML = `
      <div class="announcement-content">
        <h4 class="text-primary fw-bold mb-3">📐 欢迎来到考研数学真题研究社！</h4>
        <p class="text-secondary mb-3">本系统为离线完全复刻版，包含了 2009–2025 年全国硕士研究生招生考试数学一、数学二、数学三的全部真题图片、难易度热力分布、真题讲解视频及李艳芳老师的详尽解析。</p>
        
        <h5 class="fw-bold text-success mb-2">💡 核心功能指引：</h5>
        <ul class="text-secondary ps-3 mb-3">
          <li class="mb-2"><strong>考点大纲目录：</strong> 侧边栏为树形知识目录，点击具体知识点，真题墙上将高亮显示该考点下的真题，点击旁边的“刷题”可以进入该考点专属真题练习。</li>
          <li class="mb-2"><strong>显示题号 / 难度：</strong> 顶部控制面板支持一键开启题号标签和掌握度比例热力蒙版，快速定位“偏题怪题”与“易得题”。</li>
          <li class="mb-2"><strong>我刷的题：</strong> 开启后将把您标记为😊、😐、😭的题目以不同颜色蒙版显示在墙上，进度一目了然。</li>
          <li class="mb-2"><strong>各模块分值分布图：</strong> 页面底部统计图表将自动汇总当前学科下各章节的总分值与您的掌握进度，直接点击图表柱形图亦可快速筛选考点！</li>
        </ul>

        <div class="alert alert-info py-2 px-3 mb-0">
          <span class="small fw-bold">📢 小提示：本版本为离线纯静态单页应用（SPA），您的刷题心情投票、笔记与评论全部保存在本地浏览器 LocalStorage 中，数据安全且支持离线使用！</span>
        </div>
      </div>
    `;
  }
};

window.showToast = function(message, type = 'info') {
  $('.toast-message').remove();

  const toast = $('<div class="toast-message"></div>')
    .text(message)
    .css({
      'position': 'fixed',
      'top': '20px',
      'right': '20px',
      'padding': '12px 24px',
      'border-radius': '8px',
      'color': '#fff',
      'font-weight': 'bold',
      'z-index': '99999',
      'box-shadow': '0 4px 12px rgba(0,0,0,0.15)',
      'transition': 'all 0.3s ease',
      'opacity': '0',
      'transform': 'translateY(-20px)'
    });

  if (type === 'success') {
    toast.css('background-color', '#2dce89');
  } else if (type === 'warning') {
    toast.css('background-color', '#fb6340');
  } else if (type === 'error') {
    toast.css('background-color', '#f5365c');
  } else {
    toast.css('background-color', '#11cdef');
  }

  $('body').append(toast);
  
  setTimeout(() => {
    toast.css({
      'opacity': '1',
      'transform': 'translateY(0)'
    });
  }, 50);

  setTimeout(() => {
    toast.css({
      'opacity': '0',
      'transform': 'translateY(-20px)'
    });
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
};

// ─── 启动应用 ────────────────────────────────────────────────
$(document).ready(initApp);
