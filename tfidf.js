class TFIDFIndex {
  constructor() {
    this.documentFrequency = new Map();
    this.totalDocuments = 0;
    this.documentVectors = new Map();
    this.documentContent = new Map();
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  extractWords(html) {
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let paragraphText = '';
    let match;
    
    while ((match = paragraphRegex.exec(html)) !== null) {
      paragraphText += ' ' + match[1];
    }
    
    const withoutTags = paragraphText.replace(/<[^>]*>/g, ' ');
    
    return this.tokenize(withoutTags);
  }

  extractWordsFromText(text) {
    return this.tokenize(text);
  }

  extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    return '';
  }

  calculateIDF(word) {
    const df = this.documentFrequency.get(word.toLowerCase()) || 0;
    const raw = Math.log2(this.totalDocuments / (1 + df));
    return Math.max(0, raw);
  }

  buildIndex(pages) {
    this.documentFrequency.clear();
    this.documentVectors.clear();
    this.documentContent.clear();
    this.totalDocuments = pages.length;

    const documentWords = new Map();
    
    pages.forEach(page => {
      const words = this.extractWords(page.content);
      const uniqueWords = new Set(words);
      documentWords.set(page.url, words);
      
      uniqueWords.forEach(word => {
        this.documentFrequency.set(
          word,
          (this.documentFrequency.get(word) || 0) + 1
        );
      });

      this.documentContent.set(page.url, {
        url: page.url,
        title: page.title || this.extractTitle(page.content),
        pagerank: page.pagerank || 0
      });
    });

    pages.forEach(page => {
      const words = documentWords.get(page.url);
      const wordCounts = new Map();
      
      words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });

      const uniqueWords = Array.from(wordCounts.keys());
      const tfidfs = uniqueWords.map(word => {
        const tf = wordCounts.get(word) / words.length;
        const idf = this.calculateIDF(word);
        return Math.log2(1 + tf) * idf;
      });

      this.documentVectors.set(page.url, {
        words: uniqueWords,
        tfidfs: tfidfs
      });
    });
  }

  cosineSimilarity(queryWords, queryTfidfs, docWords, docTfidfs) {
    const docMap = new Map();
    docWords.forEach((word, i) => {
      docMap.set(word, docTfidfs[i]);
    });

    let dotProduct = 0;
    let magQ = 0;
    let magD = 0;

    for (let i = 0; i < queryWords.length; i++) {
      const qw = queryWords[i];
      const qv = queryTfidfs[i];
      const dv = docMap.get(qw) || 0;
      
      dotProduct += qv * dv;
      magQ += qv * qv;
      magD += dv * dv;
    }

    magQ = Math.sqrt(magQ);
    magD = Math.sqrt(magD);

    if (magQ === 0 || magD === 0) return 0;
    
    return dotProduct / (magQ * magD);
  }

  search(query, topK = 10, boost = false) {
    const queryWords = this.extractWordsFromText(query);
    
    const wordCounts = new Map();
    queryWords.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const uniqueQueryWords = Array.from(wordCounts.keys()).filter(word => {
      return this.documentFrequency.has(word);
    });
    
    const totalQueryLength = queryWords.length;
    
    const queryTfidfs = uniqueQueryWords.map(word => {
      const tf = wordCounts.get(word) / totalQueryLength;
      const idf = this.calculateIDF(word);
      return Math.log2(1 + tf) * idf;
    });

    const scores = [];
    
    this.documentVectors.forEach((docVector, url) => {
      const similarity = this.cosineSimilarity(
        uniqueQueryWords,
        queryTfidfs,
        docVector.words,
        docVector.tfidfs
      );

      const docInfo = this.documentContent.get(url);
      let finalScore = similarity;
      
      if (boost && docInfo.pagerank) {
        finalScore = similarity * (1 + docInfo.pagerank * 10);
      }

      scores.push({
        url: url,
        title: docInfo.title,
        score: finalScore,
        pr: docInfo.pagerank
      });
    });

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

module.exports = TFIDFIndex;
