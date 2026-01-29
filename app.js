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
        learned: 'mathreader_learned',
        chatHistory: 'mathreader_chat_history',
        lastPage: 'mathreader_last_page'
    }
};

// ===== 全局状态 =====
const state = {
    pdf: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    selectedObject: null,
    bookStructure: null,
    learned: new Set(),
    chatHistory: {},
    isLoading: false
};

// ===== PDF处理模块 =====
const PDFHandler = {
    async init() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        try {
            const loadingTask = pdfjsLib.getDocument(CONFIG.pdfPath);
            state.pdf = await loadingTask.promise;
            state.totalPages = state.pdf.numPages;
            
            document.getElementById('totalPages').textContent = state.totalPages;
            document.getElementById('pdfLoading').style.display = 'none';
            
            // 恢复上次阅读位置
            const lastPage = Storage.get(CONFIG.storageKeys.lastPage);
            if (lastPage) {
                state.currentPage = parseInt(lastPage);
            }
            
            await this.renderPage(state.currentPage);
            return true;
        } catch (error) {
            console.error('PDF加载失败:', error);
            Toast.show('PDF加载失败，请确保文件存在', 'error');
            return false;
        }
    },

    async renderPage(pageNum) {
        if (!state.pdf || pageNum < 1 || pageNum > state.totalPages) return;
        
        state.currentPage = pageNum;
        document.getElementById('currentPage').value = pageNum;
        Storage.set(CONFIG.storageKeys.lastPage, pageNum);

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
        const isLearned = state.learned.has(item.id);
        
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

        div.innerHTML = `
            <div class="toc-header" data-page="${item.page}" data-id="${item.id}">
                <span class="toc-toggle">${hasChildren ? '<i class="fas fa-chevron-right"></i>' : ''}</span>
                <span class="toc-icon ${type}"><i class="fas fa-${iconMap[type] || 'circle'}"></i></span>
                <span class="toc-text" title="${item.title}">${item.id ? item.id + ': ' : ''}${item.title}</span>
                <span class="toc-page">p.${item.page}</span>
                ${isLearned ? '<span class="toc-learned"><i class="fas fa-check-circle"></i></span>' : ''}
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
        const learnedBtn = document.getElementById('markLearned');

        typeEl.textContent = obj.type;
        typeEl.className = 'object-type ' + obj.type;
        idEl.textContent = obj.id;
        titleEl.textContent = obj.title;

        if (state.learned.has(obj.id)) {
            learnedBtn.classList.add('learned');
            learnedBtn.querySelector('i').className = 'fas fa-check-circle';
        } else {
            learnedBtn.classList.remove('learned');
            learnedBtn.querySelector('i').className = 'far fa-check-circle';
        }

        // 显示聊天面板
        document.getElementById('chatPanel').classList.remove('hidden');
    },

    updateProgress() {
        const total = parseInt(document.getElementById('totalCount').textContent) || 1;
        const learned = state.learned.size;
        document.getElementById('progressCount').textContent = learned;
        document.getElementById('progressFill').style.width = `${(learned / total) * 100}%`;
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
    async sendMessage(message) {
        if (!message.trim()) return;
        if (state.isLoading) return;

        const apiKey = Storage.get(CONFIG.storageKeys.apiKey);
        if (!apiKey) {
            Toast.show('请先设置API Key', 'warning');
            document.getElementById('apiSettings').classList.remove('hidden');
            return;
        }

        state.isLoading = true;
        
        // 添加用户消息
        this.appendMessage('user', message);
        
        // 清空输入
        document.getElementById('chatInput').value = '';
        
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
                this.saveHistory(state.selectedObject?.id, message, reply);
            } else if (data.error) {
                Toast.show(`API错误: ${data.error.message}`, 'error');
                console.error('API错误:', data.error);
            }
        } catch (error) {
            this.hideTypingIndicator();
            console.error('AI请求失败:', error);
            Toast.show('AI请求失败，请检查网络或API Key', 'error');
        }

        state.isLoading = false;
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
        if (state.learned.size > 0) {
            context += `【学生已学习的内容】: ${Array.from(state.learned).join(', ')}\n\n`;
        }

        return context;
    },

    appendMessage(role, content) {
        const container = document.getElementById('chatMessages');
        
        // 移除欢迎消息
        const welcome = container.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        msgDiv.innerHTML = `
            <div class="message-content">${this.formatMessage(content)}</div>
            <div class="message-time">${time}</div>
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

    saveHistory(objectId, userMsg, assistantMsg) {
        if (!objectId) return;
        
        if (!state.chatHistory[objectId]) {
            state.chatHistory[objectId] = [];
        }
        
        state.chatHistory[objectId].push(
            { role: 'user', content: userMsg, time: Date.now() },
            { role: 'assistant', content: assistantMsg, time: Date.now() }
        );
        
        Storage.set(CONFIG.storageKeys.chatHistory, state.chatHistory);
    },

    loadHistory(objectId) {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        
        const history = state.chatHistory[objectId];
        if (history && history.length > 0) {
            history.forEach(msg => {
                this.appendMessage(msg.role, msg.content);
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

// ===== 存储模块 =====
const Storage = {
    get(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch {
            return localStorage.getItem(key);
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (e) {
            console.error('存储失败:', e);
        }
    },

    remove(key) {
        localStorage.removeItem(key);
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

    document.getElementById('saveApiKey').addEventListener('click', () => {
        const apiKey = document.getElementById('apiKey').value.trim();
        if (apiKey) {
            Storage.set(CONFIG.storageKeys.apiKey, apiKey);
            document.getElementById('apiSettings').classList.add('hidden');
            Toast.show('API Key 已保存', 'success');
        } else {
            Toast.show('请输入有效的API Key', 'warning');
        }
    });

    // 加载已保存的API Key
    const savedApiKey = Storage.get(CONFIG.storageKeys.apiKey);
    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
        document.getElementById('apiSettings').classList.add('hidden');
    }

    // 标记已学习
    document.getElementById('markLearned').addEventListener('click', () => {
        if (!state.selectedObject) return;
        
        const id = state.selectedObject.id;
        if (state.learned.has(id)) {
            state.learned.delete(id);
            Toast.show('已取消学习标记', 'info');
        } else {
            state.learned.add(id);
            Toast.show('已标记为已学习', 'success');
        }
        
        Storage.set(CONFIG.storageKeys.learned, Array.from(state.learned));
        TOCBuilder.updateSelectedObjectUI(state.selectedObject);
        TOCBuilder.updateProgress();
        
        // 更新目录中的标记
        const tocHeader = document.querySelector(`.toc-header[data-id="${id}"]`);
        if (tocHeader) {
            const existingMark = tocHeader.querySelector('.toc-learned');
            if (state.learned.has(id) && !existingMark) {
                tocHeader.insertAdjacentHTML('beforeend', '<span class="toc-learned"><i class="fas fa-check-circle"></i></span>');
            } else if (!state.learned.has(id) && existingMark) {
                existingMark.remove();
            }
        }
    });

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
    
    // 加载已学习的内容
    const savedLearned = Storage.get(CONFIG.storageKeys.learned);
    if (savedLearned) {
        state.learned = new Set(savedLearned);
    }

    // 加载聊天历史
    const savedHistory = Storage.get(CONFIG.storageKeys.chatHistory);
    if (savedHistory) {
        state.chatHistory = savedHistory;
    }

    // 初始化UI事件
    bindUIEvents();

    // 初始化PDF
    const pdfLoaded = await PDFHandler.init();
    
    if (pdfLoaded) {
        // 初始化目录
        TOCBuilder.init();
        Toast.show('PDF加载成功！', 'success');
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
