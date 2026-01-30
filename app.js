/**
 * MathReader - 数学学习助手
 * 主应用逻辑
 */

// ===== 配置 =====
const CONFIG = {
    pdfPath: 'LADR4e.pdf',
    // Kimi API (月之暗面)
    kimiApiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    kimiModel: 'moonshot-v1-32k', // 可选: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k
    storageKeys: {
        apiKey: 'mathreader_api_key',
        learningStatus: 'mathreader_learning_status', // 学习状态（持久化）
        lastPage: 'mathreader_last_page',
        pdfFile: 'mathreader_pdf_file', // 上传的PDF文件
        pdfFileName: 'mathreader_pdf_filename' // PDF文件名
    }
};

// ===== 学习状态枚举 =====
const LearningStatus = {
    UNLEARNED: 'unlearned',    // 未学习（默认）
    LEARNED: 'learned',         // 已学习
    MASTERED: 'mastered'        // 已掌握
};

// 学习状态循环顺序
const LearningStatusCycle = [
    LearningStatus.UNLEARNED,
    LearningStatus.LEARNED,
    LearningStatus.MASTERED
];

// ===== 全局状态 =====
const state = {
    pdf: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    selectedObject: null,
    bookStructure: null,
    learningStatus: {},      // 学习状态 {objectId: status} - 从localStorage加载
    chatHistory: {},         // 对话历史 - 只在内存中，应用关闭后清除
    isLoading: false
};

// ===== PDF处理模块 =====
const PDFHandler = {
    async init() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        try {
            // 优先加载用户上传的PDF
            const savedPdfData = await Storage.get(CONFIG.storageKeys.pdfFile);
            const savedPdfName = await Storage.get(CONFIG.storageKeys.pdfFileName);
            
            let loadingTask;
            
            if (savedPdfData) {
                // 从IndexedDB加载PDF
                const uint8Array = new Uint8Array(savedPdfData);
                loadingTask = pdfjsLib.getDocument({ data: uint8Array });
                document.getElementById('currentPdfName').textContent = savedPdfName || '已上传的PDF';
                document.getElementById('currentPdfName').title = savedPdfName || '已上传的PDF';
            } else {
                // 加载默认PDF
                loadingTask = pdfjsLib.getDocument(CONFIG.pdfPath);
                document.getElementById('currentPdfName').textContent = 'LADR4e.pdf';
                document.getElementById('currentPdfName').title = '默认PDF文件';
            }
            
            state.pdf = await loadingTask.promise;
            state.totalPages = state.pdf.numPages;
            
            document.getElementById('totalPages').textContent = state.totalPages;
            document.getElementById('pdfLoading').style.display = 'none';
            
            // 恢复上次阅读位置
            const lastPage = await Storage.get(CONFIG.storageKeys.lastPage);
            if (lastPage) {
                state.currentPage = parseInt(lastPage);
            }
            
            await this.renderPage(state.currentPage);
            return true;
        } catch (error) {
            console.error('PDF加载失败:', error);
            Toast.show('PDF加载失败，请检查文件或上传新的PDF', 'error');
            return false;
        }
    },
    
    async loadPdfFromFile(file) {
        if (!file || file.type !== 'application/pdf') {
            Toast.show('请选择有效的PDF文件', 'error');
            return false;
        }
        
        // 检查文件大小（限制为50MB）
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            Toast.show('PDF文件过大，请选择小于50MB的文件', 'error');
            return false;
        }
        
        try {
            document.getElementById('pdfLoading').style.display = 'block';
            Toast.show('正在上传PDF文件...', 'info');
            
            // 读取文件为ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // 保存到IndexedDB
            await Storage.set(CONFIG.storageKeys.pdfFile, Array.from(uint8Array));
            await Storage.set(CONFIG.storageKeys.pdfFileName, file.name);
            
            // 加载PDF
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
            state.pdf = await loadingTask.promise;
            state.totalPages = state.pdf.numPages;
            
            // 重置到第一页
            state.currentPage = 1;
            await Storage.set(CONFIG.storageKeys.lastPage, 1);
            
            document.getElementById('totalPages').textContent = state.totalPages;
            document.getElementById('currentPage').value = 1;
            document.getElementById('currentPdfName').textContent = file.name;
            document.getElementById('currentPdfName').title = file.name;
            document.getElementById('pdfLoading').style.display = 'none';
            
            await this.renderPage(1);
            
            Toast.show(`PDF文件 "${file.name}" 加载成功！`, 'success');
            return true;
        } catch (error) {
            console.error('PDF上传失败:', error);
            document.getElementById('pdfLoading').style.display = 'none';
            Toast.show('PDF上传失败，请重试', 'error');
            return false;
        }
    },
    
    async clearUploadedPdf() {
        await Storage.remove(CONFIG.storageKeys.pdfFile);
        await Storage.remove(CONFIG.storageKeys.pdfFileName);
        Toast.show('已清除上传的PDF，将使用默认PDF', 'info');
    },

    async renderPage(pageNum) {
        if (!state.pdf || pageNum < 1 || pageNum > state.totalPages) return;
        
        state.currentPage = pageNum;
        document.getElementById('currentPage').value = pageNum;
        Storage.set(CONFIG.storageKeys.lastPage, pageNum).catch(() => {});

        const page = await state.pdf.getPage(pageNum);
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        
        const container = document.getElementById('pdfContainer');
        const containerWidth = container.clientWidth - 40;
        
        const viewport = page.getViewport({ scale: 1 });
        const scale = (containerWidth / viewport.width) * state.scale;
        const scaledViewport = page.getViewport({ scale });

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        await page.render({
            canvasContext: ctx,
            viewport: scaledViewport
        }).promise;

        document.getElementById('zoomLevel').textContent = Math.round(state.scale * 100) + '%';
    },

    async goToPage(pageNum) {
        await this.renderPage(pageNum);
    },

    prevPage() {
        if (state.currentPage > 1) {
            this.renderPage(state.currentPage - 1);
        }
    },

    nextPage() {
        if (state.currentPage < state.totalPages) {
            this.renderPage(state.currentPage + 1);
        }
    },

    zoomIn() {
        state.scale = Math.min(state.scale + 0.25, 3);
        this.renderPage(state.currentPage);
    },

    zoomOut() {
        state.scale = Math.max(state.scale - 0.25, 0.5);
        this.renderPage(state.currentPage);
    },

    fitWidth() {
        state.scale = 1;
        this.renderPage(state.currentPage);
    },

    // 获取页面文本内容
    async getPageText(pageNum) {
        if (!state.pdf) return '';
        const page = await state.pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        return textContent.items.map(item => item.str).join(' ');
    },

    // 获取多页文本内容
    async getPagesText(startPage, endPage) {
        let text = '';
        for (let i = startPage; i <= Math.min(endPage, state.totalPages); i++) {
            text += await this.getPageText(i) + '\n\n';
        }
        return text;
    }
};

// ===== 目录构建模块 =====
const TOCBuilder = {
    init() {
        // 使用预定义的书籍结构
        state.bookStructure = this.getBookStructure();
        this.render();
        this.updateProgress();
    },

    // 书籍结构（从PDF目录提取）
    getBookStructure() {
        return {
            chapters: [
                {
                    id: 'ch1',
                    title: 'Chapter 1: Vector Spaces',
                    page: 15,
                    sections: [
                        {
                            id: '1A',
                            title: '1A: ℝⁿ and ℂⁿ',
                            page: 16,
                            objects: [
                                { id: '1.1', type: 'definition', title: 'complex numbers, ℂ', page: 16 },
                                { id: '1.2', type: 'example', title: 'complex arithmetic', page: 16 },
                                { id: '1.3', type: 'property', title: 'properties of complex arithmetic', page: 17 },
                                { id: '1.4', type: 'example', title: 'commutativity of complex multiplication', page: 17 },
                                { id: '1.5', type: 'definition', title: '−α, subtraction, 1/α, division', page: 18 },
                                { id: '1.6', type: 'definition', title: '𝐅 (notation)', page: 18 },
                                { id: '1.7', type: 'example', title: 'ℝ² and ℝ³', page: 19 },
                                { id: '1.8', type: 'definition', title: 'list, length', page: 19 },
                                { id: '1.9', type: 'example', title: 'lists versus sets', page: 19 },
                                { id: '1.10', type: 'definition', title: 'n (notation)', page: 20 },
                                { id: '1.11', type: 'definition', title: '𝐅ⁿ, coordinate', page: 20 },
                                { id: '1.12', type: 'example', title: 'ℂ⁴', page: 20 },
                                { id: '1.13', type: 'definition', title: 'addition in 𝐅ⁿ', page: 20 },
                                { id: '1.14', type: 'theorem', title: 'commutativity of addition in 𝐅ⁿ', page: 21 },
                                { id: '1.15', type: 'definition', title: '0 (notation)', page: 21 },
                                { id: '1.16', type: 'example', title: 'context determines which 0', page: 21 },
                                { id: '1.17', type: 'definition', title: 'additive inverse in 𝐅ⁿ, −x', page: 23 },
                                { id: '1.18', type: 'definition', title: 'scalar multiplication in 𝐅ⁿ', page: 23 }
                            ],
                            exercises: this.generateExercises('1A', 24, 15)
                        },
                        {
                            id: '1B',
                            title: '1B: Definition of Vector Space',
                            page: 26,
                            objects: [
                                { id: '1.19', type: 'definition', title: 'addition, scalar multiplication', page: 26 },
                                { id: '1.20', type: 'definition', title: 'vector space', page: 26 },
                                { id: '1.21', type: 'definition', title: 'vector, point', page: 26 },
                                { id: '1.22', type: 'definition', title: 'real vector space, complex vector space', page: 27 },
                                { id: '1.23', type: 'example', title: '𝐅∞', page: 27 },
                                { id: '1.24', type: 'definition', title: '𝐅ˢ (notation)', page: 27 },
                                { id: '1.25', type: 'example', title: '𝐅ˢ is a vector space', page: 28 },
                                { id: '1.26', type: 'theorem', title: 'unique additive identity', page: 28 },
                                { id: '1.27', type: 'theorem', title: 'unique additive inverse', page: 29 },
                                { id: '1.28', type: 'definition', title: '−v, w − v (notation)', page: 29 },
                                { id: '1.29', type: 'definition', title: 'V (notation)', page: 29 },
                                { id: '1.30', type: 'theorem', title: 'the number 0 times a vector', page: 29 },
                                { id: '1.31', type: 'theorem', title: 'a number times the vector 0', page: 30 },
                                { id: '1.32', type: 'theorem', title: 'the number −1 times a vector', page: 30 }
                            ],
                            exercises: this.generateExercises('1B', 30, 8)
                        },
                        {
                            id: '1C',
                            title: '1C: Subspaces',
                            page: 32,
                            objects: [
                                { id: '1.33', type: 'definition', title: 'subspace', page: 32 },
                                { id: '1.34', type: 'theorem', title: 'conditions for a subspace', page: 32 },
                                { id: '1.35', type: 'example', title: 'subspaces', page: 33 },
                                { id: '1.36', type: 'definition', title: 'sum of subspaces', page: 33 },
                                { id: '1.37', type: 'example', title: 'a sum of subspaces of 𝐅³', page: 34 },
                                { id: '1.38', type: 'example', title: 'a sum of subspaces of 𝐅⁴', page: 34 },
                                { id: '1.40', type: 'theorem', title: 'sum of subspaces is smallest containing subspace', page: 35 },
                                { id: '1.41', type: 'definition', title: 'direct sum, ⊕', page: 35 },
                                { id: '1.42', type: 'example', title: 'a direct sum of two subspaces', page: 35 },
                                { id: '1.43', type: 'example', title: 'a direct sum of multiple subspaces', page: 36 },
                                { id: '1.44', type: 'example', title: 'a sum that is not a direct sum', page: 36 },
                                { id: '1.45', type: 'theorem', title: 'condition for a direct sum', page: 37 },
                                { id: '1.46', type: 'theorem', title: 'direct sum of two subspaces', page: 37 }
                            ],
                            exercises: this.generateExercises('1C', 38, 24)
                        }
                    ]
                },
                {
                    id: 'ch2',
                    title: 'Chapter 2: Finite-Dimensional Vector Spaces',
                    page: 41,
                    sections: [
                        {
                            id: '2A',
                            title: '2A: Span and Linear Independence',
                            page: 42,
                            objects: [
                                { id: '2.1', type: 'definition', title: 'list of vectors (notation)', page: 42 },
                                { id: '2.2', type: 'definition', title: 'linear combination', page: 42 },
                                { id: '2.3', type: 'example', title: 'linear combinations in ℝ³', page: 42 },
                                { id: '2.4', type: 'definition', title: 'span', page: 43 },
                                { id: '2.5', type: 'example', title: 'span', page: 43 },
                                { id: '2.6', type: 'theorem', title: 'span is the smallest containing subspace', page: 43 },
                                { id: '2.7', type: 'definition', title: 'spans', page: 43 },
                                { id: '2.8', type: 'example', title: 'a list that spans 𝐅ⁿ', page: 44 },
                                { id: '2.9', type: 'definition', title: 'finite-dimensional vector space', page: 44 },
                                { id: '2.10', type: 'definition', title: 'polynomial, 𝒫(𝐅)', page: 44 },
                                { id: '2.11', type: 'definition', title: 'degree of a polynomial, deg p', page: 45 },
                                { id: '2.12', type: 'definition', title: '𝒫ₘ(𝐅) (notation)', page: 45 },
                                { id: '2.13', type: 'definition', title: 'infinite-dimensional vector space', page: 45 },
                                { id: '2.14', type: 'example', title: '𝒫(𝐅) is infinite-dimensional', page: 45 },
                                { id: '2.15', type: 'definition', title: 'linearly independent', page: 46 },
                                { id: '2.16', type: 'example', title: 'linearly independent lists', page: 46 },
                                { id: '2.17', type: 'definition', title: 'linearly dependent', page: 47 },
                                { id: '2.18', type: 'example', title: 'linearly dependent lists', page: 47 },
                                { id: '2.19', type: 'lemma', title: 'linear dependence lemma', page: 47 },
                                { id: '2.21', type: 'example', title: 'smallest k in linear dependence lemma', page: 48 },
                                { id: '2.22', type: 'theorem', title: 'length of linearly independent list ≤ length of spanning list', page: 49 },
                                { id: '2.23', type: 'example', title: 'no list of length 4 is linearly independent in ℝ³', page: 50 },
                                { id: '2.24', type: 'example', title: 'no list of length 3 spans ℝ⁴', page: 50 },
                                { id: '2.25', type: 'theorem', title: 'finite-dimensional subspaces', page: 50 }
                            ],
                            exercises: this.generateExercises('2A', 51, 25)
                        },
                        {
                            id: '2B',
                            title: '2B: Bases',
                            page: 53,
                            objects: [
                                { id: '2.26', type: 'definition', title: 'basis', page: 53 },
                                { id: '2.27', type: 'example', title: 'bases', page: 53 },
                                { id: '2.28', type: 'theorem', title: 'criterion for basis', page: 54 },
                                { id: '2.29', type: 'theorem', title: 'spanning list contains a basis', page: 54 },
                                { id: '2.30', type: 'example', title: 'finding a basis by removing vectors', page: 55 },
                                { id: '2.31', type: 'theorem', title: 'basis of finite-dimensional vector space', page: 55 },
                                { id: '2.32', type: 'theorem', title: 'linearly independent list extends to a basis', page: 55 },
                                { id: '2.33', type: 'example', title: 'extending a linearly independent list to a basis', page: 55 },
                                { id: '2.34', type: 'theorem', title: 'every subspace is part of a direct sum equal to V', page: 56 }
                            ],
                            exercises: this.generateExercises('2B', 56, 16)
                        },
                        {
                            id: '2C',
                            title: '2C: Dimension',
                            page: 58,
                            objects: [
                                { id: '2.35', type: 'theorem', title: 'basis length does not depend on basis', page: 58 },
                                { id: '2.36', type: 'definition', title: 'dimension, dim V', page: 58 },
                                { id: '2.37', type: 'example', title: 'dimensions', page: 58 },
                                { id: '2.38', type: 'theorem', title: 'dimension of a subspace', page: 59 },
                                { id: '2.39', type: 'theorem', title: 'linearly independent list of the right length is a basis', page: 59 },
                                { id: '2.40', type: 'example', title: 'showing a list is a basis', page: 59 },
                                { id: '2.41', type: 'theorem', title: 'spanning list of the right length is a basis', page: 60 },
                                { id: '2.42', type: 'theorem', title: 'dimension of a sum', page: 60 }
                            ],
                            exercises: this.generateExercises('2C', 62, 17)
                        }
                    ]
                },
                {
                    id: 'ch3',
                    title: 'Chapter 3: Linear Maps',
                    page: 65,
                    sections: [
                        {
                            id: '3A',
                            title: '3A: Vector Space of Linear Maps',
                            page: 66,
                            objects: [
                                { id: '3.1', type: 'definition', title: 'linear map', page: 66 },
                                { id: '3.2', type: 'definition', title: 'ℒ(V, W)', page: 66 },
                                { id: '3.3', type: 'example', title: 'linear maps', page: 66 },
                                { id: '3.4', type: 'theorem', title: 'linear maps and basis of domain', page: 68 },
                                { id: '3.5', type: 'definition', title: 'addition and scalar multiplication on ℒ(V, W)', page: 69 },
                                { id: '3.6', type: 'theorem', title: 'ℒ(V, W) is a vector space', page: 69 },
                                { id: '3.7', type: 'definition', title: 'product of linear maps', page: 70 },
                                { id: '3.8', type: 'theorem', title: 'algebraic properties of products of linear maps', page: 70 }
                            ],
                            exercises: this.generateExercises('3A', 71, 18)
                        },
                        {
                            id: '3B',
                            title: '3B: Null Spaces and Ranges',
                            page: 73,
                            objects: [
                                { id: '3.9', type: 'definition', title: 'null space, null T', page: 73 },
                                { id: '3.10', type: 'theorem', title: 'null space is a subspace', page: 73 },
                                { id: '3.11', type: 'definition', title: 'injective', page: 74 },
                                { id: '3.12', type: 'theorem', title: 'injectivity is equivalent to null space equals {0}', page: 74 },
                                { id: '3.13', type: 'definition', title: 'range', page: 75 },
                                { id: '3.14', type: 'theorem', title: 'range is a subspace', page: 75 },
                                { id: '3.15', type: 'definition', title: 'surjective', page: 76 },
                                { id: '3.16', type: 'example', title: 'map to smaller dimensional space is not surjective', page: 76 },
                                { id: '3.17', type: 'definition', title: 'rank, rank T', page: 76 },
                                { id: '3.21', type: 'theorem', title: 'fundamental theorem of linear maps', page: 76 },
                                { id: '3.22', type: 'example', title: 'fundamental theorem with derivative map', page: 77 },
                                { id: '3.23', type: 'theorem', title: 'map to a smaller dimension is not injective', page: 77 },
                                { id: '3.24', type: 'theorem', title: 'map to a larger dimension is not surjective', page: 78 }
                            ],
                            exercises: this.generateExercises('3B', 80, 30)
                        }
                    ]
                },
                {
                    id: 'ch5',
                    title: 'Chapter 5: Eigenvalues and Eigenvectors',
                    page: 146,
                    sections: [
                        {
                            id: '5A',
                            title: '5A: Invariant Subspaces',
                            page: 147,
                            objects: [
                                { id: '5.1', type: 'definition', title: 'operator, ℒ(V)', page: 147 },
                                { id: '5.2', type: 'definition', title: 'invariant subspace', page: 147 },
                                { id: '5.3', type: 'example', title: 'invariant subspaces', page: 147 },
                                { id: '5.5', type: 'definition', title: 'eigenvalue', page: 148 },
                                { id: '5.6', type: 'theorem', title: 'equivalent conditions for eigenvalue', page: 148 },
                                { id: '5.7', type: 'definition', title: 'eigenvector', page: 149 },
                                { id: '5.8', type: 'example', title: 'finding eigenvalues and eigenvectors', page: 149 },
                                { id: '5.10', type: 'theorem', title: 'linearly independent eigenvectors', page: 150 },
                                { id: '5.11', type: 'theorem', title: 'number of eigenvalues', page: 151 }
                            ],
                            exercises: this.generateExercises('5A', 153, 29)
                        },
                        {
                            id: '5B',
                            title: '5B: The Minimal Polynomial',
                            page: 157,
                            objects: [
                                { id: '5.17', type: 'theorem', title: 'existence of eigenvalues on complex vector spaces', page: 157 },
                                { id: '5.19', type: 'theorem', title: 'operators on complex vector spaces have eigenvalues', page: 158 },
                                { id: '5.20', type: 'definition', title: 'monic polynomial', page: 159 },
                                { id: '5.21', type: 'definition', title: 'minimal polynomial', page: 159 },
                                { id: '5.22', type: 'theorem', title: 'existence and uniqueness of minimal polynomial', page: 160 },
                                { id: '5.24', type: 'definition', title: 'minimal polynomial of T', page: 160 },
                                { id: '5.25', type: 'theorem', title: 'q(T) = 0 implies minimal polynomial divides q', page: 161 },
                                { id: '5.27', type: 'theorem', title: 'eigenvalues are zeros of minimal polynomial', page: 161 }
                            ],
                            exercises: this.generateExercises('5B', 164, 22)
                        },
                        {
                            id: '5D',
                            title: '5D: Diagonalizable Operators',
                            page: 177,
                            objects: [
                                { id: '5.38', type: 'definition', title: 'diagonal matrix', page: 177 },
                                { id: '5.39', type: 'definition', title: 'diagonalizable', page: 177 },
                                { id: '5.41', type: 'theorem', title: 'conditions equivalent to diagonalizability', page: 178 },
                                { id: '5.44', type: 'theorem', title: 'enough eigenvalues implies diagonalizability', page: 180 }
                            ],
                            exercises: this.generateExercises('5D', 186, 21)
                        }
                    ]
                },
                {
                    id: 'ch6',
                    title: 'Chapter 6: Inner Product Spaces',
                    page: 195,
                    sections: [
                        {
                            id: '6A',
                            title: '6A: Inner Products and Norms',
                            page: 196,
                            objects: [
                                { id: '6.1', type: 'definition', title: 'inner product', page: 196 },
                                { id: '6.2', type: 'example', title: 'Euclidean inner product', page: 197 },
                                { id: '6.3', type: 'example', title: 'inner product on 𝒫(𝐅)', page: 197 },
                                { id: '6.5', type: 'definition', title: 'inner product space', page: 198 },
                                { id: '6.7', type: 'theorem', title: 'basic properties of inner product', page: 198 },
                                { id: '6.9', type: 'definition', title: 'norm, ‖v‖', page: 199 },
                                { id: '6.10', type: 'theorem', title: 'basic properties of norm', page: 200 },
                                { id: '6.11', type: 'definition', title: 'orthogonal', page: 201 },
                                { id: '6.12', type: 'theorem', title: 'Pythagorean theorem', page: 201 },
                                { id: '6.13', type: 'theorem', title: 'orthogonal decomposition', page: 201 },
                                { id: '6.14', type: 'theorem', title: 'Cauchy-Schwarz inequality', page: 202 },
                                { id: '6.15', type: 'theorem', title: 'triangle inequality', page: 203 },
                                { id: '6.16', type: 'theorem', title: 'parallelogram equality', page: 204 }
                            ],
                            exercises: this.generateExercises('6A', 205, 32)
                        },
                        {
                            id: '6B',
                            title: '6B: Orthonormal Bases',
                            page: 211,
                            objects: [
                                { id: '6.23', type: 'definition', title: 'orthonormal', page: 211 },
                                { id: '6.24', type: 'example', title: 'orthonormal lists', page: 211 },
                                { id: '6.25', type: 'theorem', title: 'orthonormal list is linearly independent', page: 212 },
                                { id: '6.26', type: 'definition', title: 'orthonormal basis', page: 212 },
                                { id: '6.28', type: 'theorem', title: 'writing a vector as linear combination of orthonormal basis', page: 213 },
                                { id: '6.32', type: 'theorem', title: 'Gram-Schmidt procedure', page: 214 },
                                { id: '6.34', type: 'theorem', title: 'orthonormal basis exists', page: 216 }
                            ],
                            exercises: this.generateExercises('6B', 221, 25)
                        }
                    ]
                },
                {
                    id: 'ch7',
                    title: 'Chapter 7: Operators on Inner Product Spaces',
                    page: 241,
                    sections: [
                        {
                            id: '7A',
                            title: '7A: Self-Adjoint and Normal Operators',
                            page: 242,
                            objects: [
                                { id: '7.1', type: 'definition', title: 'adjoint, T*', page: 242 },
                                { id: '7.2', type: 'theorem', title: 'existence and uniqueness of adjoint', page: 242 },
                                { id: '7.5', type: 'theorem', title: 'properties of adjoint', page: 244 },
                                { id: '7.7', type: 'definition', title: 'self-adjoint', page: 246 },
                                { id: '7.10', type: 'theorem', title: 'eigenvalues of self-adjoint operators are real', page: 247 },
                                { id: '7.13', type: 'definition', title: 'normal', page: 249 },
                                { id: '7.14', type: 'theorem', title: 'T normal iff ‖Tv‖ = ‖T*v‖', page: 249 }
                            ],
                            exercises: this.generateExercises('7A', 253, 26)
                        },
                        {
                            id: '7B',
                            title: '7B: Spectral Theorem',
                            page: 257,
                            objects: [
                                { id: '7.24', type: 'theorem', title: 'real spectral theorem', page: 257 },
                                { id: '7.29', type: 'theorem', title: 'complex spectral theorem', page: 260 }
                            ],
                            exercises: this.generateExercises('7B', 261, 14)
                        }
                    ]
                }
            ]
        };
    },

    generateExercises(sectionId, startPage, count) {
        const exercises = [];
        for (let i = 1; i <= count; i++) {
            exercises.push({
                id: `Ex.${sectionId}.${i}`,
                type: 'exercise',
                title: `Exercise ${i}`,
                page: startPage
            });
        }
        return exercises;
    },

    render() {
        const container = document.getElementById('tocContainer');
        container.innerHTML = '';
        
        let totalObjects = 0;
        
        state.bookStructure.chapters.forEach(chapter => {
            const chapterEl = this.createTocItem(chapter, 1, 'chapter');
            
            chapter.sections.forEach(section => {
                const sectionEl = this.createTocItem(section, 2, 'section');
                
                section.objects.forEach(obj => {
                    const objEl = this.createTocItem(obj, 3, obj.type);
                    sectionEl.querySelector('.toc-children').appendChild(objEl);
                    totalObjects++;
                });

                // 添加习题折叠组
                if (section.exercises && section.exercises.length > 0) {
                    const exerciseGroup = document.createElement('div');
                    exerciseGroup.className = 'toc-item';
                    exerciseGroup.setAttribute('data-level', '3');
                    exerciseGroup.innerHTML = `
                        <div class="toc-header">
                            <span class="toc-toggle"><i class="fas fa-chevron-right"></i></span>
                            <span class="toc-icon exercise"><i class="fas fa-edit"></i></span>
                            <span class="toc-text">Exercises ${section.id} (${section.exercises.length})</span>
                        </div>
                        <div class="toc-children"></div>
                    `;
                    
                    section.exercises.forEach(ex => {
                        const exEl = this.createTocItem(ex, 4, 'exercise');
                        exerciseGroup.querySelector('.toc-children').appendChild(exEl);
                        totalObjects++;
                    });
                    
                    sectionEl.querySelector('.toc-children').appendChild(exerciseGroup);
                }
                
                chapterEl.querySelector('.toc-children').appendChild(sectionEl);
            });
            
            container.appendChild(chapterEl);
        });

        document.getElementById('totalCount').textContent = totalObjects;
        this.bindEvents();
    },

    createTocItem(item, level, type) {
        const div = document.createElement('div');
        div.className = 'toc-item';
        div.setAttribute('data-level', level);
        div.setAttribute('data-id', item.id);

        const hasChildren = item.sections || item.objects || item.exercises;
        const learningStatus = Storage.getLearningStatus(item.id);
        
        const iconMap = {
            'chapter': 'book',
            'section': 'bookmark',
            'definition': 'lightbulb',
            'theorem': 'star',
            'example': 'pencil-alt',
            'exercise': 'edit',
            'lemma': 'puzzle-piece',
            'proof': 'check',
            'property': 'list'
        };

        // 学习状态图标
        let statusIcon = '';
        if (learningStatus === LearningStatus.LEARNED) {
            statusIcon = '<span class="toc-status learned"><i class="fas fa-check-circle"></i></span>';
        } else if (learningStatus === LearningStatus.MASTERED) {
            statusIcon = '<span class="toc-status mastered"><i class="fas fa-star"></i></span>';
        }

        div.innerHTML = `
            <div class="toc-header" data-page="${item.page}" data-id="${item.id}">
                <span class="toc-toggle">${hasChildren ? '<i class="fas fa-chevron-right"></i>' : ''}</span>
                <span class="toc-icon ${type}"><i class="fas fa-${iconMap[type] || 'circle'}"></i></span>
                <span class="toc-text" title="${item.title}">${item.id ? item.id + ': ' : ''}${item.title}</span>
                <span class="toc-page">p.${item.page}</span>
                ${statusIcon}
            </div>
            ${hasChildren ? '<div class="toc-children"></div>' : ''}
        `;

        return div;
    },

    bindEvents() {
        document.querySelectorAll('.toc-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const toggle = header.querySelector('.toc-toggle');
                const children = header.parentElement.querySelector('.toc-children');
                
                // 切换展开/折叠
                if (toggle && toggle.innerHTML && children) {
                    toggle.classList.toggle('expanded');
                    children.classList.toggle('expanded');
                }

                // 跳转到页面
                const page = parseInt(header.dataset.page);
                if (page) {
                    PDFHandler.goToPage(page);
                }

                // 选中对象
                const id = header.dataset.id;
                if (id && !id.startsWith('ch') && !id.match(/^\d[A-Z]$/)) {
                    this.selectObject(id);
                }

                // 高亮当前选中
                document.querySelectorAll('.toc-header.active').forEach(el => el.classList.remove('active'));
                header.classList.add('active');
            });
        });
    },

    selectObject(id) {
        // 查找对象信息
        let obj = null;
        state.bookStructure.chapters.forEach(chapter => {
            chapter.sections.forEach(section => {
                const found = section.objects.find(o => o.id === id) || 
                             section.exercises?.find(e => e.id === id);
                if (found) {
                    obj = { ...found, section: section.id, chapter: chapter.id };
                }
            });
        });

        if (obj) {
            state.selectedObject = obj;
            this.updateSelectedObjectUI(obj);
            ChatHandler.loadHistory(id);
        }
    },

    updateSelectedObjectUI(obj) {
        const typeEl = document.getElementById('objectType');
        const idEl = document.getElementById('objectId');
        const titleEl = document.getElementById('objectTitle');
        const statusBtn = document.getElementById('learningStatusBtn');
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');

        typeEl.textContent = obj.type;
        typeEl.className = 'object-type ' + obj.type;
        idEl.textContent = obj.id;
        titleEl.textContent = obj.title;

        // 更新学习状态按钮
        const status = Storage.getLearningStatus(obj.id);
        this.updateLearningStatusButton(status, statusBtn, statusIcon, statusText);

        // 显示聊天面板和操作按钮
        document.getElementById('chatPanel').classList.remove('hidden');
        const chatActions = document.getElementById('chatActions');
        if (chatActions) {
            chatActions.style.display = 'flex';
        }
    },

    updateLearningStatusButton(status, btn, icon, text) {
        btn.className = 'learning-status-btn ' + status;
        
        if (status === LearningStatus.LEARNED) {
            icon.className = 'fas fa-check-circle';
            text.textContent = '已学习';
            btn.title = '点击切换为已掌握';
        } else if (status === LearningStatus.MASTERED) {
            icon.className = 'fas fa-star';
            text.textContent = '已掌握';
            btn.title = '点击切换为未学习';
        } else {
            icon.className = 'far fa-circle';
            text.textContent = '未学习';
            btn.title = '点击切换为已学习';
        }
    },

    updateProgress() {
        const total = parseInt(document.getElementById('totalCount').textContent) || 1;
        const statuses = Storage.getLearningStatusesSync();
        // 统计已学习和已掌握的数量
        const learnedCount = Object.values(statuses).filter(s => 
            s === LearningStatus.LEARNED || s === LearningStatus.MASTERED
        ).length;
        document.getElementById('progressCount').textContent = learnedCount;
        document.getElementById('progressFill').style.width = `${(learnedCount / total) * 100}%`;
    },

    filterToc(searchText) {
        const items = document.querySelectorAll('.toc-item');
        const lowerSearch = searchText.toLowerCase();
        
        items.forEach(item => {
            const header = item.querySelector('.toc-header');
            const text = header?.querySelector('.toc-text')?.textContent.toLowerCase() || '';
            const match = text.includes(lowerSearch);
            
            if (searchText === '') {
                item.style.display = '';
            } else {
                item.style.display = match ? '' : 'none';
                if (match) {
                    // 展开父级
                    let parent = item.parentElement;
                    while (parent && parent.classList.contains('toc-children')) {
                        parent.classList.add('expanded');
                        parent = parent.parentElement?.parentElement;
                    }
                }
            }
        });
    }
};

// ===== AI聊天模块 =====
const ChatHandler = {
    async sendMessage(message, retryCount = 0) {
        if (!message.trim()) return;
        if (state.isLoading) return;

        // 优先从文件系统加载API Key
        let apiKey = null;
        if (FileSystemStorage.dataFolderHandle) {
            try {
                apiKey = await FileSystemStorage.loadApiKey();
            } catch (error) {
                console.warn('从文件系统加载API Key失败:', error);
            }
        }
        
        // 如果文件系统没有，从IndexedDB加载
        if (!apiKey) {
            apiKey = await Storage.get(CONFIG.storageKeys.apiKey);
        }
        
        if (!apiKey) {
            Toast.show('请先设置API Key', 'warning');
            document.getElementById('apiSettings').classList.remove('hidden');
            return;
        }

        state.isLoading = true;
        
        // 只在第一次请求时添加用户消息和清空输入
        if (retryCount === 0) {
            this.appendMessage('user', message);
            document.getElementById('chatInput').value = '';
        }
        
        // 显示加载指示器
        this.showTypingIndicator();

        try {
            // 构建上下文
            const context = await this.buildContext();
            
            // 构建消息列表 (Kimi API 使用 OpenAI 兼容格式)
            const messages = [
                {
                    role: 'system',
                    content: context
                },
                {
                    role: 'user',
                    content: message
                }
            ];

            // 添加历史消息（最近10条）
            if (state.selectedObject && state.chatHistory[state.selectedObject.id]) {
                const history = state.chatHistory[state.selectedObject.id].slice(-10);
                const historyMessages = history.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
                // 插入到system消息之后，当前用户消息之前
                messages.splice(1, 0, ...historyMessages);
            }

            const response = await fetch(CONFIG.kimiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: CONFIG.kimiModel,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2048
                })
            });

            const data = await response.json();
            
            this.hideTypingIndicator();

            if (data.choices && data.choices[0]) {
                const reply = data.choices[0].message.content;
                this.appendMessage('assistant', reply);
                await this.saveHistory(state.selectedObject?.id, message, reply);
                state.isLoading = false;
            } else if (data.error) {
                const errorCode = data.error.code || '';
                const errorMessage = data.error.message || '未知错误';
                
                // 处理overload错误（429或overload相关错误）
                if (errorCode === 'overload' || 
                    errorCode === 'rate_limit_exceeded' || 
                    errorMessage.toLowerCase().includes('overload') ||
                    errorMessage.toLowerCase().includes('overload') ||
                    response.status === 429) {
                    
                    // 自动重试机制（最多重试3次，指数退避）
                    if (retryCount < 3) {
                        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                        Toast.show(`服务器过载，${delay/1000}秒后自动重试 (${retryCount + 1}/3)...`, 'warning');
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return this.sendMessage(message, retryCount + 1);
                    } else {
                        Toast.show('服务器过载，请稍后再试。这是月之暗面API服务端的问题，不是程序问题。', 'error');
                    }
                } else if (errorCode === 'insufficient_quota' || errorMessage.includes('quota')) {
                    Toast.show('API配额不足，请检查账户余额或升级套餐', 'error');
                } else if (errorCode === 'invalid_api_key' || response.status === 401) {
                    Toast.show('API Key无效，请检查设置', 'error');
                } else {
                    Toast.show(`API错误: ${errorMessage}`, 'error');
                }
                console.error('API错误:', data.error);
                state.isLoading = false;
            } else {
                Toast.show('API返回了意外的响应格式', 'error');
                console.error('意外的API响应:', data);
                state.isLoading = false;
            }
        } catch (error) {
            this.hideTypingIndicator();
            console.error('AI请求失败:', error);
            
            // 网络错误也尝试重试
            if (retryCount < 2 && (error.message.includes('fetch') || error.message.includes('network'))) {
                const delay = Math.pow(2, retryCount) * 1000;
                Toast.show(`网络错误，${delay/1000}秒后自动重试...`, 'warning');
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendMessage(message, retryCount + 1);
            }
            
            Toast.show('AI请求失败，请检查网络连接', 'error');
            state.isLoading = false;
        }
    },

    async buildContext() {
        let context = `你是一个专业的数学教师，正在帮助学生学习《Linear Algebra Done Right》（线性代数应该这样学）这本线性代数教材。

你的任务是：
1. 用通俗易懂的语言解释数学概念
2. 提供具体的例子帮助理解
3. 指出与其他知识点的联系
4. 如果涉及数学公式，请使用LaTeX格式（用$包围行内公式，用$$包围独立公式）
5. 用中文回答所有问题

`;
        
        if (state.selectedObject) {
            const obj = state.selectedObject;
            context += `【当前学习内容】\n`;
            context += `- 类型: ${obj.type}\n`;
            context += `- 编号: ${obj.id}\n`;
            context += `- 标题: ${obj.title}\n`;
            context += `- 位置: 第${obj.page}页\n\n`;

            // 获取相关页面的文本内容
            try {
                const pageText = await PDFHandler.getPagesText(obj.page, obj.page + 1);
                context += `【教材原文内容】\n${pageText.substring(0, 4000)}\n\n`;
            } catch (e) {
                console.error('获取页面文本失败:', e);
            }
        }

        // 添加已学内容作为背景
        const statuses = Storage.getLearningStatuses();
        const learnedIds = Object.keys(statuses).filter(id => 
            statuses[id] === LearningStatus.LEARNED || statuses[id] === LearningStatus.MASTERED
        );
        if (learnedIds.length > 0) {
            context += `【学生已学习的内容】: ${learnedIds.join(', ')}\n\n`;
        }

        // 添加导入的历史记录（如果有）
        if (state.selectedObject && state.chatHistory[state.selectedObject.id]) {
            const history = state.chatHistory[state.selectedObject.id];
            const importedHistory = history.filter(msg => msg.imported);
            if (importedHistory.length > 0) {
                context += `【之前的对话历史（已导入）】\n`;
                importedHistory.forEach(msg => {
                    const timeStr = new Date(msg.time).toLocaleString('zh-CN');
                    context += `[${timeStr}] ${msg.role === 'user' ? '学生' : 'AI'}: ${msg.content}\n`;
                });
                context += `\n`;
            }
        }

        return context;
    },

    appendMessage(role, content, timestamp = null, isImported = false) {
        const container = document.getElementById('chatMessages');
        
        // 移除欢迎消息
        const welcome = container.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}${isImported ? ' imported' : ''}`;
        
        const time = timestamp ? new Date(timestamp).toLocaleString('zh-CN') : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const importedBadge = isImported ? '<span class="imported-badge" title="已导入的历史记录"><i class="fas fa-file-import"></i></span>' : '';
        
        msgDiv.innerHTML = `
            <div class="message-content">${this.formatMessage(content)}</div>
            <div class="message-time">${importedBadge}${time}</div>
        `;
        
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    },

    formatMessage(content) {
        // 保护LaTeX公式不被其他处理影响
        const latexBlocks = [];
        const latexInlines = [];
        
        let processed = content;
        
        // 块级公式: \[ ... \] 或 $$ ... $$
        processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => {
            latexBlocks.push(p1.trim());
            return `%%LATEXBLOCK${latexBlocks.length - 1}%%`;
        });
        processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, p1) => {
            latexBlocks.push(p1.trim());
            return `%%LATEXBLOCK${latexBlocks.length - 1}%%`;
        });
        
        // 行内公式: \( ... \) 或 $ ... $
        processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => {
            latexInlines.push(p1.trim());
            return `%%LATEXINLINE${latexInlines.length - 1}%%`;
        });
        processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, p1) => {
            latexInlines.push(p1.trim());
            return `%%LATEXINLINE${latexInlines.length - 1}%%`;
        });
        
        // Markdown转换
        processed = processed
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n/g, '<br>');
        
        // 恢复并渲染块级公式
        processed = processed.replace(/%%LATEXBLOCK(\d+)%%/g, (match, idx) => {
            try {
                return `<div class="math-block">${katex.renderToString(latexBlocks[parseInt(idx)], { displayMode: true, throwOnError: false })}</div>`;
            } catch (e) {
                console.error('LaTeX渲染错误:', e);
                return `<div class="math-block math-error">${latexBlocks[parseInt(idx)]}</div>`;
            }
        });
        
        // 恢复并渲染行内公式
        processed = processed.replace(/%%LATEXINLINE(\d+)%%/g, (match, idx) => {
            try {
                return `<span class="math-inline">${katex.renderToString(latexInlines[parseInt(idx)], { displayMode: false, throwOnError: false })}</span>`;
            } catch (e) {
                console.error('LaTeX渲染错误:', e);
                return `<span class="math-inline math-error">${latexInlines[parseInt(idx)]}</span>`;
            }
        });
        
        return processed;
    },

    showTypingIndicator() {
        const container = document.getElementById('chatMessages');
        const indicator = document.createElement('div');
        indicator.className = 'message assistant typing';
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    },

    hideTypingIndicator() {
        const indicator = document.querySelector('.message.typing');
        if (indicator) indicator.remove();
    },

    async saveHistory(objectId, userMsg, assistantMsg) {
        if (!objectId) return;
        
        if (!state.chatHistory[objectId]) {
            state.chatHistory[objectId] = [];
        }
        
        // 添加到内存
        state.chatHistory[objectId].push(
            { role: 'user', content: userMsg, time: Date.now() },
            { role: 'assistant', content: assistantMsg, time: Date.now() }
        );
        
        // 自动持久化保存到IndexedDB
        await Storage.saveChatHistory(objectId, state.chatHistory[objectId]);
        
        // 注意：文件系统保存需要用户手动点击"保存"按钮
    },

    loadHistory(objectId) {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        
        const history = state.chatHistory[objectId];
        if (history && history.length > 0) {
            history.forEach(msg => {
                this.appendMessage(msg.role, msg.content, msg.time, msg.imported || false);
            });
        } else {
            // 显示欢迎消息
            container.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-graduation-cap"></i>
                    <h4>开始学习 ${objectId}</h4>
                    <p>向AI提问来帮助理解这个内容。</p>
                    <div class="quick-prompts">
                        <button class="quick-prompt" data-prompt="请解释这个概念">
                            <i class="fas fa-lightbulb"></i> 解释概念
                        </button>
                        <button class="quick-prompt" data-prompt="能举一个具体的例子吗">
                            <i class="fas fa-pencil-alt"></i> 举个例子
                        </button>
                        <button class="quick-prompt" data-prompt="这个和之前学的内容有什么联系">
                            <i class="fas fa-link"></i> 知识联系
                        </button>
                    </div>
                </div>
            `;
            this.bindQuickPrompts();
        }
    },

    bindQuickPrompts() {
        document.querySelectorAll('.quick-prompt').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                this.sendMessage(prompt);
            });
        });
    }
};

// ===== 存储模块（使用IndexedDB） =====
const Storage = {
    db: null,
    dbName: 'MathReaderDB',
    dbVersion: 1,
    useLocalStorage: false, // 是否使用localStorage作为回退
    
    // 初始化IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            // 检查浏览器是否支持IndexedDB
            if (!window.indexedDB) {
                console.log('浏览器不支持IndexedDB，使用localStorage');
                this.useLocalStorage = true;
                resolve();
                return;
            }
            
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.warn('IndexedDB打开失败，回退到localStorage');
                this.useLocalStorage = true;
                resolve();
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB初始化成功');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建对象存储
                if (!db.objectStoreNames.contains('data')) {
                    const objectStore = db.createObjectStore('data', { keyPath: 'key' });
                    objectStore.createIndex('key', 'key', { unique: true });
                }
            };
        });
    },
    
    // 通用get方法（兼容localStorage和IndexedDB）
    async get(key) {
        if (this.useLocalStorage) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : null;
            } catch {
                return localStorage.getItem(key);
            }
        }
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }
            
            const transaction = this.db.transaction(['data'], 'readonly');
            const objectStore = transaction.objectStore('data');
            const request = objectStore.get(key);
            
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };
            
            request.onerror = () => {
                console.error('读取失败:', request.error);
                resolve(null);
            };
        });
    },
    
    // 同步get方法（用于初始化时）
    getSync(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch {
            return localStorage.getItem(key);
        }
    },
    
    // 通用set方法
    async set(key, value) {
        if (this.useLocalStorage) {
            try {
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                return;
            } catch (e) {
                console.error('存储失败:', e);
                Toast.show('存储失败，可能是存储空间不足', 'error');
                return;
            }
        }
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                // 回退到localStorage
                try {
                    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                } catch (e) {
                    console.error('存储失败:', e);
                }
                resolve();
                return;
            }
            
            const transaction = this.db.transaction(['data'], 'readwrite');
            const objectStore = transaction.objectStore('data');
            const request = objectStore.put({ key: key, value: value });
            
            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = () => {
                console.error('存储失败:', request.error);
                // 回退到localStorage
                try {
                    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                } catch (e) {
                    Toast.show('存储失败，可能是存储空间不足', 'error');
                }
                resolve();
            };
        });
    },
    
    remove(key) {
        if (this.useLocalStorage) {
            localStorage.removeItem(key);
            return;
        }
        
        if (!this.db) return;
        
        const transaction = this.db.transaction(['data'], 'readwrite');
        const objectStore = transaction.objectStore('data');
        objectStore.delete(key);
    },

    // ===== 学习状态管理（持久化） =====
    async saveLearningStatus(objectId, status) {
        const statuses = await this.getLearningStatuses();
        statuses[objectId] = status;
        
        // 优先保存到文件系统（如果已选择文件夹）
        if (FileSystemStorage.dataFolderHandle) {
            await FileSystemStorage.saveLearningStatus(statuses);
        }
        
        // 同时保存到IndexedDB作为备份
        await this.set(CONFIG.storageKeys.learningStatus, statuses);
    },

    getLearningStatus(objectId) {
        const statuses = this.getLearningStatusesSync();
        return statuses[objectId] || LearningStatus.UNLEARNED;
    },

    async getLearningStatuses() {
        // 优先从文件系统加载（如果已选择文件夹）
        if (FileSystemStorage.dataFolderHandle) {
            try {
                const fileStatuses = await FileSystemStorage.loadLearningStatus();
                if (fileStatuses && Object.keys(fileStatuses).length > 0) {
                    return fileStatuses;
                }
            } catch (error) {
                console.warn('从文件系统加载学习状态失败，使用IndexedDB:', error);
            }
        }
        
        // 从IndexedDB加载
        const data = await this.get(CONFIG.storageKeys.learningStatus);
        return data || {};
    },
    
    getLearningStatusesSync() {
        const data = this.getSync(CONFIG.storageKeys.learningStatus);
        return data || {};
    },

    // 迁移旧数据：从 learned Set 转换为新的状态格式
    async migrateOldData() {
        const oldLearned = await this.get('mathreader_learned');
        if (oldLearned && Array.isArray(oldLearned) && oldLearned.length > 0) {
            const currentStatuses = await this.getLearningStatuses();
            oldLearned.forEach(id => {
                if (!currentStatuses[id]) {
                    currentStatuses[id] = LearningStatus.LEARNED;
                }
            });
            await this.set(CONFIG.storageKeys.learningStatus, currentStatuses);
            console.log('已迁移旧的学习状态数据');
        }
    },
    
    // ===== 对话历史管理（持久化） =====
    async saveChatHistory(objectId, history) {
        await this.set(`chatHistory_${objectId}`, history);
    },
    
    async getChatHistory(objectId) {
        return await this.get(`chatHistory_${objectId}`) || [];
    },
    
    async getAllChatHistories() {
        // 获取所有对话历史
        if (this.useLocalStorage) {
            const histories = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('chatHistory_')) {
                    const objectId = key.replace('chatHistory_', '');
                    try {
                        histories[objectId] = JSON.parse(localStorage.getItem(key));
                    } catch (e) {
                        console.error('读取对话历史失败:', key, e);
                    }
                }
            }
            return histories;
        }
        
        // IndexedDB方式
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve({});
                return;
            }
            
            const histories = {};
            const transaction = this.db.transaction(['data'], 'readonly');
            const objectStore = transaction.objectStore('data');
            const request = objectStore.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const key = cursor.key;
                    if (key && key.startsWith('chatHistory_')) {
                        const objectId = key.replace('chatHistory_', '');
                        histories[objectId] = cursor.value.value;
                    }
                    cursor.continue();
                } else {
                    resolve(histories);
                }
            };
            
            request.onerror = () => {
                resolve({});
            };
        });
    }
};

// ===== 文件系统存储模块（File System Access API） =====
const FileSystemStorage = {
    dataFolderHandle: null,
    folderPath: null,
    
    // 检查浏览器是否支持File System Access API
    isSupported() {
        return 'showDirectoryPicker' in window;
    },
    
    // 选择数据文件夹
    async selectDataFolder() {
        if (!this.isSupported()) {
            Toast.show('您的浏览器不支持文件系统访问API（需要Chrome/Edge）', 'error');
            return false;
        }
        
        try {
            const handle = await window.showDirectoryPicker();
            this.dataFolderHandle = handle;
            
            // 保存文件夹句柄（使用IndexedDB保存权限）
            await Storage.set('dataFolderHandle', {
                name: handle.name,
                kind: handle.kind
            });
            
            // 尝试获取路径（可能不支持）
            try {
                this.folderPath = handle.name;
            } catch (e) {
                this.folderPath = '已选择文件夹';
            }
            
            document.getElementById('dataFolderPath').value = this.folderPath;
            Toast.show('文件夹选择成功', 'success');
            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('选择文件夹失败:', error);
                Toast.show('选择文件夹失败', 'error');
            }
            return false;
        }
    },
    
    // 恢复文件夹访问权限
    async restoreFolderAccess() {
        const saved = await Storage.get('dataFolderHandle');
        if (!saved) return false;
        
        // 注意：File System Access API不直接支持恢复权限
        // 需要用户重新选择文件夹
        return false;
    },
    
    // 获取文件句柄（如果不存在则创建）
    async getFileHandle(filename, create = false) {
        if (!this.dataFolderHandle) {
            throw new Error('未选择数据文件夹');
        }
        
        try {
            return await this.dataFolderHandle.getFileHandle(filename, { create });
        } catch (error) {
            if (error.name === 'NotFoundError' && create) {
                throw error;
            }
            throw error;
        }
    },
    
    // 读取文件
    async readFile(filename) {
        try {
            const fileHandle = await this.getFileHandle(filename, false);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch (error) {
            if (error.name === 'NotFoundError') {
                return null;
            }
            throw error;
        }
    },
    
    // 写入文件
    async writeFile(filename, data) {
        if (!this.dataFolderHandle) {
            throw new Error('未选择数据文件夹');
        }
        
        const fileHandle = await this.getFileHandle(filename, true);
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    },
    
    // 列出文件夹中的所有文件
    async listFiles(pattern = null) {
        if (!this.dataFolderHandle) {
            return [];
        }
        
        const files = [];
        for await (const entry of this.dataFolderHandle.values()) {
            if (entry.kind === 'file') {
                if (!pattern || entry.name.match(pattern)) {
                    files.push({
                        name: entry.name,
                        handle: entry
                    });
                }
            }
        }
        return files;
    },
    
    // 保存API Key
    async saveApiKey(apiKey) {
        await this.writeFile('api_key.json', { apiKey, updatedAt: Date.now() });
    },
    
    // 加载API Key
    async loadApiKey() {
        const data = await this.readFile('api_key.json');
        return data?.apiKey || null;
    },
    
    // 保存学习状态
    async saveLearningStatus(statuses) {
        await this.writeFile('learning_status.json', {
            statuses,
            updatedAt: Date.now()
        });
    },
    
    // 加载学习状态
    async loadLearningStatus() {
        const data = await this.readFile('learning_status.json');
        return data?.statuses || {};
    },
    
    // 保存对话历史到文件
    async saveChatHistory(objectId, history) {
        if (!history || history.length === 0) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `chat_${objectId}_${timestamp}.json`;
        
        const data = {
            objectId,
            messages: history,
            savedAt: Date.now(),
            savedAtString: new Date().toLocaleString('zh-CN')
        };
        
        await this.writeFile(filename, data);
        Toast.show(`对话历史已保存: ${filename}`, 'success');
    },
    
    // 获取对象的所有对话历史文件
    async getChatHistoryFiles(objectId) {
        const pattern = new RegExp(`^chat_${objectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_`);
        const files = await this.listFiles(pattern);
        
        // 读取文件信息并按时间排序
        const fileInfos = await Promise.all(files.map(async (file) => {
            try {
                const data = await this.readFile(file.name);
                return {
                    filename: file.name,
                    objectId: data?.objectId || objectId,
                    messageCount: data?.messages?.length || 0,
                    savedAt: data?.savedAt || 0,
                    savedAtString: data?.savedAtString || '未知时间',
                    handle: file.handle
                };
            } catch (error) {
                console.error('读取文件信息失败:', file.name, error);
                return null;
            }
        }));
        
        // 过滤null并按时间倒序排序
        return fileInfos
            .filter(info => info !== null)
            .sort((a, b) => b.savedAt - a.savedAt);
    },
    
    // 加载对话历史文件
    async loadChatHistoryFile(filename) {
        const data = await this.readFile(filename);
        return data?.messages || [];
    }
};

// ===== 对话历史导出/导入模块 =====
const HistoryExport = {
    exportHistory(objectId) {
        const history = state.chatHistory[objectId];
        if (!history || history.length === 0) {
            Toast.show('当前对象没有对话历史', 'warning');
            return;
        }

        const obj = state.selectedObject;
        const exportData = {
            version: '1.0',
            objectId: objectId,
            objectTitle: obj?.title || '',
            objectType: obj?.type || '',
            exportTime: new Date().toISOString(),
            exportTimeString: new Date().toLocaleString('zh-CN'),
            messages: history.map(msg => ({
                role: msg.role,
                content: msg.content,
                time: msg.time,
                timeString: new Date(msg.time).toLocaleString('zh-CN')
            }))
        };

        // 创建JSON文件并下载
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${objectId}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Toast.show('对话历史已导出', 'success');
    },

    async importHistory(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // 验证文件格式
                    if (!data.version || !data.objectId || !Array.isArray(data.messages)) {
                        throw new Error('无效的导出文件格式');
                    }

                    // 验证是否与当前对象匹配
                    if (state.selectedObject && data.objectId !== state.selectedObject.id) {
                        const confirm = window.confirm(
                            `文件中的对象ID (${data.objectId}) 与当前选择的对象 (${state.selectedObject.id}) 不匹配。\n` +
                            `是否仍要导入？导入的历史将添加到当前对象。`
                        );
                        if (!confirm) {
                            reject(new Error('用户取消导入'));
                            return;
                        }
                    }

                    // 加载到当前对象的对话历史
                    const objectId = state.selectedObject?.id || data.objectId;
                    if (!state.chatHistory[objectId]) {
                        state.chatHistory[objectId] = [];
                    }

                    // 合并历史记录（追加，避免重复）
                    const existingTimes = new Set(state.chatHistory[objectId].map(m => m.time));
                    data.messages.forEach(msg => {
                        if (!existingTimes.has(msg.time)) {
                            state.chatHistory[objectId].push({
                                role: msg.role,
                                content: msg.content,
                                time: msg.time || Date.now(),
                                imported: true // 标记为导入的记录
                            });
                        }
                    });

                    // 按时间排序
                    state.chatHistory[objectId].sort((a, b) => a.time - b.time);

                    // 重新加载显示
                    if (state.selectedObject && state.selectedObject.id === objectId) {
                        ChatHandler.loadHistory(objectId);
                    }

                    Toast.show(`已导入 ${data.messages.length} 条对话记录`, 'success');
                    resolve(data);
                } catch (error) {
                    console.error('导入失败:', error);
                    Toast.show(`导入失败: ${error.message}`, 'error');
                    reject(error);
                }
            };
            reader.onerror = () => {
                const error = new Error('文件读取失败');
                Toast.show(error.message, 'error');
                reject(error);
            };
            reader.readAsText(file);
        });
    }
};

// ===== Toast通知 =====
const Toast = {
    show(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation' : 'info'}-circle"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// ===== UI事件绑定 =====
function bindUIEvents() {
    // PDF导航
    document.getElementById('prevPage').addEventListener('click', () => PDFHandler.prevPage());
    document.getElementById('nextPage').addEventListener('click', () => PDFHandler.nextPage());
    document.getElementById('currentPage').addEventListener('change', (e) => {
        PDFHandler.goToPage(parseInt(e.target.value));
    });
    document.getElementById('zoomIn').addEventListener('click', () => PDFHandler.zoomIn());
    document.getElementById('zoomOut').addEventListener('click', () => PDFHandler.zoomOut());
    document.getElementById('fitWidth').addEventListener('click', () => PDFHandler.fitWidth());

    // PDF上传
    document.getElementById('uploadPdf').addEventListener('click', () => {
        document.getElementById('pdfFileInput').click();
    });

    document.getElementById('pdfFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await PDFHandler.loadPdfFromFile(file);
            // 清空文件选择，允许重复选择同一文件
            e.target.value = '';
        }
    });

    // 侧边栏折叠
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // 聊天面板
    document.getElementById('toggleChat').addEventListener('click', () => {
        document.getElementById('chatPanel').classList.toggle('hidden');
    });
    document.getElementById('closeChat').addEventListener('click', () => {
        document.getElementById('chatPanel').classList.add('hidden');
    });

    // API Key设置
    document.getElementById('toggleApiKey').addEventListener('click', () => {
        const input = document.getElementById('apiKey');
        const icon = document.getElementById('toggleApiKey').querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });

    document.getElementById('saveApiKey').addEventListener('click', async () => {
        const apiKey = document.getElementById('apiKey').value.trim();
        if (apiKey) {
            // 优先保存到文件系统（如果已选择文件夹）
            if (FileSystemStorage.dataFolderHandle) {
                try {
                    await FileSystemStorage.saveApiKey(apiKey);
                } catch (error) {
                    console.error('保存API Key到文件系统失败:', error);
                }
            }
            
            // 同时保存到IndexedDB作为备份
            await Storage.set(CONFIG.storageKeys.apiKey, apiKey);
            document.getElementById('apiSettings').classList.add('hidden');
            Toast.show('API Key 已保存', 'success');
        } else {
            Toast.show('请输入有效的API Key', 'warning');
        }
    });

    // 选择数据文件夹
    document.getElementById('selectDataFolder').addEventListener('click', async () => {
        await FileSystemStorage.selectDataFolder();
    });

    // 加载已保存的API Key（异步）
    (async () => {
        let savedApiKey = null;
        
        // 优先从文件系统加载
        if (FileSystemStorage.dataFolderHandle) {
            try {
                savedApiKey = await FileSystemStorage.loadApiKey();
            } catch (error) {
                console.warn('从文件系统加载API Key失败，使用IndexedDB:', error);
            }
        }
        
        // 如果文件系统没有，从IndexedDB加载
        if (!savedApiKey) {
            savedApiKey = await Storage.get(CONFIG.storageKeys.apiKey);
        }
        
        if (savedApiKey) {
            document.getElementById('apiKey').value = savedApiKey;
            document.getElementById('apiSettings').classList.add('hidden');
        }
    })();

    // 学习状态按钮（三态循环：未学习 → 已学习 → 已掌握 → 未学习）
    document.getElementById('learningStatusBtn').addEventListener('click', () => {
        if (!state.selectedObject) return;
        
        const id = state.selectedObject.id;
        const currentStatus = Storage.getLearningStatus(id);
        const currentIndex = LearningStatusCycle.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % LearningStatusCycle.length;
        const nextStatus = LearningStatusCycle[nextIndex];
        
        // 保存新状态
        Storage.saveLearningStatus(id, nextStatus).then(() => {
            state.learningStatus[id] = nextStatus;
        });
        
        // 更新UI
        const statusBtn = document.getElementById('learningStatusBtn');
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');
        TOCBuilder.updateLearningStatusButton(nextStatus, statusBtn, statusIcon, statusText);
        
        // 更新目录中的标记
        const tocHeader = document.querySelector(`.toc-header[data-id="${id}"]`);
        if (tocHeader) {
            const existingStatus = tocHeader.querySelector('.toc-status');
            if (existingStatus) {
                existingStatus.remove();
            }
            
            if (nextStatus === LearningStatus.LEARNED) {
                tocHeader.insertAdjacentHTML('beforeend', '<span class="toc-status learned"><i class="fas fa-check-circle"></i></span>');
            } else if (nextStatus === LearningStatus.MASTERED) {
                tocHeader.insertAdjacentHTML('beforeend', '<span class="toc-status mastered"><i class="fas fa-star"></i></span>');
            }
        }
        
        // 更新进度
        TOCBuilder.updateProgress();
        
        // 提示消息
        const statusMessages = {
            [LearningStatus.UNLEARNED]: '已标记为未学习',
            [LearningStatus.LEARNED]: '已标记为已学习',
            [LearningStatus.MASTERED]: '已标记为已掌握'
        };
        Toast.show(statusMessages[nextStatus], 'success');
    });

    // 保存对话历史到文件
    document.getElementById('saveHistoryToFile').addEventListener('click', async () => {
        if (!state.selectedObject) {
            Toast.show('请先选择一个对象', 'warning');
            return;
        }
        
        if (!FileSystemStorage.dataFolderHandle) {
            Toast.show('请先选择数据文件夹', 'warning');
            document.getElementById('apiSettings').classList.remove('hidden');
            return;
        }
        
        const objectId = state.selectedObject.id;
        const history = state.chatHistory[objectId];
        
        if (!history || history.length === 0) {
            Toast.show('当前对象没有对话历史', 'warning');
            return;
        }
        
        try {
            await FileSystemStorage.saveChatHistory(objectId, history);
        } catch (error) {
            console.error('保存对话历史失败:', error);
            Toast.show('保存失败: ' + error.message, 'error');
        }
    });

    // 从文件加载对话历史
    document.getElementById('loadHistoryFromFiles').addEventListener('click', async () => {
        if (!state.selectedObject) {
            Toast.show('请先选择一个对象', 'warning');
            return;
        }
        
        if (!FileSystemStorage.dataFolderHandle) {
            Toast.show('请先选择数据文件夹', 'warning');
            document.getElementById('apiSettings').classList.remove('hidden');
            return;
        }
        
        const objectId = state.selectedObject.id;
        
        try {
            // 获取该对象的所有对话历史文件
            const files = await FileSystemStorage.getChatHistoryFiles(objectId);
            
            if (files.length === 0) {
                Toast.show('没有找到该对象的对话历史文件', 'info');
                return;
            }
            
            // 显示文件列表弹窗
            showHistoryFilesModal(files, objectId);
        } catch (error) {
            console.error('加载对话历史文件列表失败:', error);
            Toast.show('加载文件列表失败: ' + error.message, 'error');
        }
    });
    
    // 显示对话历史文件列表弹窗
    function showHistoryFilesModal(files, objectId) {
        const modal = document.getElementById('historyFilesModal');
        const listContainer = document.getElementById('historyFilesList');
        const loadBtn = document.getElementById('loadSelectedHistory');
        
        // 清空列表
        listContainer.innerHTML = '';
        
        // 存储选中的文件
        const selectedFiles = new Set();
        
        // 生成文件列表
        files.forEach((fileInfo, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'history-file-item';
            fileItem.style.cssText = 'padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius); margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `file_${index}`;
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedFiles.add(fileInfo.filename);
                } else {
                    selectedFiles.delete(fileInfo.filename);
                }
                loadBtn.disabled = selectedFiles.size === 0;
            });
            
            const label = document.createElement('label');
            label.htmlFor = `file_${index}`;
            label.style.cssText = 'flex: 1; cursor: pointer;';
            label.innerHTML = `
                <div style="font-weight: 500; margin-bottom: 4px;">${fileInfo.filename}</div>
                <div style="font-size: 12px; color: var(--text-muted);">
                    消息数: ${fileInfo.messageCount} | 保存时间: ${fileInfo.savedAtString}
                </div>
            `;
            
            fileItem.appendChild(checkbox);
            fileItem.appendChild(label);
            listContainer.appendChild(fileItem);
        });
        
        // 重置加载按钮
        loadBtn.disabled = true;
        loadBtn.onclick = async () => {
            if (selectedFiles.size === 0) return;
            
            try {
                // 加载选中的文件
                const allMessages = [];
                for (const filename of selectedFiles) {
                    const messages = await FileSystemStorage.loadChatHistoryFile(filename);
                    allMessages.push(...messages);
                }
                
                // 按时间排序
                allMessages.sort((a, b) => a.time - b.time);
                
                // 合并到当前对象的对话历史
                if (!state.chatHistory[objectId]) {
                    state.chatHistory[objectId] = [];
                }
                
                // 避免重复（基于时间戳）
                const existingTimes = new Set(state.chatHistory[objectId].map(m => m.time));
                allMessages.forEach(msg => {
                    if (!existingTimes.has(msg.time)) {
                        state.chatHistory[objectId].push({
                            ...msg,
                            imported: true
                        });
                    }
                });
                
                // 重新排序
                state.chatHistory[objectId].sort((a, b) => a.time - b.time);
                
                // 保存到IndexedDB
                await Storage.saveChatHistory(objectId, state.chatHistory[objectId]);
                
                // 重新加载显示
                ChatHandler.loadHistory(objectId);
                
                // 关闭弹窗
                modal.classList.remove('active');
                
                Toast.show(`已加载 ${selectedFiles.size} 个文件的对话历史`, 'success');
            } catch (error) {
                console.error('加载对话历史失败:', error);
                Toast.show('加载失败: ' + error.message, 'error');
            }
        };
        
        // 取消按钮
        document.getElementById('cancelLoadHistory').onclick = () => {
            modal.classList.remove('active');
        };
        
        // 关闭按钮
        document.getElementById('closeHistoryFilesModal').onclick = () => {
            modal.classList.remove('active');
        };
        
        // 显示弹窗
        modal.classList.add('active');
    }

    // 聊天输入
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessage');

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            ChatHandler.sendMessage(chatInput.value);
        }
    });

    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    sendBtn.addEventListener('click', () => {
        ChatHandler.sendMessage(chatInput.value);
    });

    // 快捷提示
    ChatHandler.bindQuickPrompts();

    // 目录搜索
    document.getElementById('tocSearch').addEventListener('input', (e) => {
        TOCBuilder.filterToc(e.target.value);
    });

    // 窗口大小调整时重新渲染PDF
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            PDFHandler.renderPage(state.currentPage);
        }, 200);
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case 'ArrowLeft':
                PDFHandler.prevPage();
                break;
            case 'ArrowRight':
                PDFHandler.nextPage();
                break;
            case '+':
            case '=':
                PDFHandler.zoomIn();
                break;
            case '-':
                PDFHandler.zoomOut();
                break;
        }
    });
}

// ===== 初始化 =====
async function init() {
    console.log('MathReader 初始化中...');
    
    // 初始化存储系统（IndexedDB或localStorage）
    await Storage.init();
    
    // 迁移旧数据（从 learned Set 转换为新的状态格式）
    await Storage.migrateOldData();
    
    // 加载学习状态（持久化）- 优先从文件系统加载
    state.learningStatus = await Storage.getLearningStatuses();
    
    // 加载所有对话历史（持久化）- 从IndexedDB加载（文件系统的历史需要手动加载）
    state.chatHistory = await Storage.getAllChatHistories();
    
    // 检查是否已选择数据文件夹
    if (FileSystemStorage.isSupported()) {
        // 尝试恢复文件夹访问（虽然API不支持，但可以提示用户）
        const folderInfo = await Storage.get('dataFolderHandle');
        if (folderInfo) {
            document.getElementById('dataFolderPath').value = folderInfo.name || '需要重新选择';
        }
    } else {
        document.getElementById('selectDataFolder').disabled = true;
        document.getElementById('selectDataFolder').title = '您的浏览器不支持文件系统访问API（需要Chrome/Edge）';
    }

    // 初始化UI事件
    bindUIEvents();

    // 初始化PDF
    const pdfLoaded = await PDFHandler.init();
    
    if (pdfLoaded) {
        // 初始化目录
        TOCBuilder.init();
        Toast.show('PDF加载成功！数据已自动恢复', 'success');
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
