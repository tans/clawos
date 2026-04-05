document.addEventListener('DOMContentLoaded', function() {
  var carousel = document.getElementById('carousel');
  if (carousel) {
    var indicators = document.querySelectorAll('.carousel-indicator');
    var currentIndex = 0;
    var totalSlides = 3;
    
    function updateCarousel() {
      carousel.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
      indicators.forEach(function(indicator, index) {
        if (index === currentIndex) {
          indicator.classList.add('bg-primary-600');
          indicator.classList.remove('bg-gray-300');
        } else {
          indicator.classList.remove('bg-primary-600');
          indicator.classList.add('bg-gray-300');
        }
      });
    }
    
    function nextSlide() {
      currentIndex = (currentIndex + 1) % totalSlides;
      updateCarousel();
    }
    
    indicators.forEach(function(indicator, index) {
      indicator.addEventListener('click', function() {
        currentIndex = index;
        updateCarousel();
      });
    });
    
    // 自动轮播
    setInterval(nextSlide, 5000);
  }
});