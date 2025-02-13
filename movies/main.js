function debounce(func, interval) {
  let handle = null
  return function(...args) {
    if (handle) {
      clearTimeout(handle)
    }
    handle = setTimeout(() =>{
      func(...args)
    }, interval)
  }
}
const elSearch = document.getElementById('search')

elSearch.addEventListener('keyup', debounce(event => {
  const searchTerm = event.target.value
  searchFor(searchTerm)
}, 500))

async function searchFor(searchTerm) {
  const filename = encodeURIComponent(searchTerm)

  const response = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${filename}.json?includeVideos=0`, {
    mode: 'no-cors'
  })
  const json = await response.json()
  const elOutput = document.getElementById('output')
  elOutput.innerHTML = ''
  for (const result of json.d) {
    if (!['tvSeries', 'movie'].includes(result.qid)) continue;
    const elItem = document.createElement('div')
    elItem.classList.add('item')
    elItem.innerHTML = `
    <button onclick="${result.qid === 'tvSeries' ? `findEpisodes('${result.id}')` : `gotoMovie('${result.id}')`}">
      <div class="left">
        ${result.i.imageUrl ? `<img src="${result.i.imageUrl}">` : ''}
      </div>
      <div class="right">
        <div>Title: ${result.l}</div>
        <div>Type: ${result.qid}
      </div>
    </button>
`
    elOutput.appendChild(elItem)
  }
}

async function findEpisodes(imdb) {
  const elSeason = document.getElementById('season')
  const elEpisode = document.getElementById('episode')
  const season = elSeason.value
  const episode = elEpisode.value
  window.open(`https://vidsrc.xyz/embed/tv?imdb=${imdb}&season=${season}&episode=${episode}`, '_blank')
}

async function gotoMovie(imdb) {
  window.open(`https://vidsrc.xyz/embed/movie?imdb=${imdb}`, '_blank')
}
