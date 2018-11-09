$(".clickable-card").click(function(){
  window.location = $(this).data("link");
  return false
});
