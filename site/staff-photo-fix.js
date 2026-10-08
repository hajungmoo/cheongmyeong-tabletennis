// Keep coaching staff cards compact without cropping the coach photos.
if (typeof document !== 'undefined' && !document.getElementById('staffPhotoFixStyles')) {
  const style = document.createElement('style');
  style.id = 'staffPhotoFixStyles';
  style.textContent = `
    .championship .staffPhoto{
      aspect-ratio:auto!important;
      height:220px!important;
      min-height:0!important;
      background:linear-gradient(145deg,#eef0f0,#d9dcdf)!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      overflow:hidden!important;
    }
    .championship .staffPhoto::after{
      height:14%!important;
      opacity:.45!important;
    }
    .championship .staffPhoto img{
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      object-position:center center!important;
      transform:none!important;
    }
    .championship .staffCard:hover .staffPhoto img{
      transform:none!important;
    }
    @media(max-width:800px){
      .championship .staffPhoto{height:180px!important;}
    }
    @media(max-width:600px){
      .championship .staffGrid{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
      }
      .championship .staffPhoto{
        height:132px!important;
        aspect-ratio:auto!important;
      }
      .championship .staffPhoto::after{
        height:10%!important;
      }
      .championship .staffPhoto img{
        object-fit:contain!important;
        object-position:center center!important;
      }
    }
  `;
  document.head.append(style);
}
