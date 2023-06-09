class BionicRead {

  constructor() {
    this.processDocument();
  }

  processDocument() {
    const nodes = [...document.querySelectorAll('body *:not(script, style, svg)')];
    nodes.forEach(this.processNode);
  }

  unprocessNode(node) {
    const parentElement = node.parentNode;
    if (!parentElement) return;
    parentElement._bionics?.forEach(config => {
      try {
        const { originalNode, children } = config;
        parentElement.insertBefore(originalNode, children[0]);
        children.forEach(node => parentElement.removeChild(node));
      } catch (er) {
      }
    });
    delete node._isBionic;
    delete parentElement._bionics;
  }

  processNode(node) {
    const textNodes = [...node.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .filter(node => node.nodeValue.trim());
    if (!textNodes.length) return;
    textNodes.forEach(function apply(node) {
      const parentElement = node.parentNode;
      parentElement._isBionic = true;
      const value = String(node.nodeValue);
      const whiteSpaces = [...value.matchAll(/\s/g)];
      let last = 0;
      const embolden = whiteSpaces.reduce((parts, entry) => {
        const next = entry.index;
        parts.push(value.substring(last, next + 1));
        last = next + 1;
        return parts;
      }, []);
      const end = value.substring(last, value.length);
      if (end) embolden.push(end);
      const children = [];
      embolden.map(text => {
        const length = text.trim().length;
        if (!length) return [document.createTextNode(text)];
        const emboldenLength = Math.min(Math.ceil(length / 2), 2);
        const span1 = document.createElement('span');
        span1.classList.add('highlight')
        span1.innerText = text.substring(0, emboldenLength).replace(/\n/g, '');
        const span2 = document.createElement('span');
        span2.classList.add('downlight')
        span2.innerText = text.substring(emboldenLength).replace(/\n/g, '');
        return [
          span1,
          span2
        ];
      }).forEach(rw => {
        rw.forEach(wi => {
          wi._isBionic = true;
          children.push(wi);
          parentElement.insertBefore(wi, node);
        });
      });
      parentElement._bionics = parentElement._bionics ?? [];
      parentElement._bionics.push({
        originalNode: node,
        children
      });
      parentElement.removeChild(node);
    });
  }

}