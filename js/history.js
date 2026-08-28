/* ============================================================
   LÓGICA PARA EL SWIPE INTERACTIVO DEL MAZO DE CARTAS
   ============================================================ */

const deck = document.getElementById('swipeDeck');
const container = document.getElementById('swipeHistoryContainer');
const cards = document.querySelectorAll('.swipe-card');
let currentIndex = 0;
let startY = 0;
let isSwiping = false;

// Detección de swipe en el contenedor
container.addEventListener('touchstart', (e) => {
  startY = e.touches[0].clientY;
  isSwiping = true;
});

container.addEventListener('touchend', (e) => {
  if (!isSwiping) return;
  const endY = e.changedTouches[0].clientY;
  const diffY = startY - endY;

  // Si es un swipe hacia arriba y es significativo (> 100px)
  if (diffY > 100) {
    rotateCards();
  }
  isSwiping = false;
});

// Función para rotar las cartas del mazo
function rotateCards() {
  const currentCard = cards[currentIndex];
  
  // Añadir la clase de animación de swipe up
  currentCard.classList.add('swipe-up');

  // Esperar a que termine la animación
  setTimeout(() => {
    // Mover la carta actual al final de la pila en el DOM
    currentCard.classList.remove('active', 'swipe-up');
    deck.appendChild(currentCard);
    
    // Actualizar el índice y activar la siguiente carta
    currentIndex = (currentIndex + 1) % cards.length;
    cards[currentIndex].classList.add('active');
    
    // Forzar un reflow para asegurar que el orden de las capas se actualice correctamente
    deck.offsetHeight;
  }, 400); // Coincide con la duración del CSS
}

/* --- (Opcional) Funciones para las flechas de navegación lateral --- */
document.querySelector('.arrow-next').addEventListener('click', rotateCards);
document.querySelector('.arrow-prev').addEventListener('click', () => {
  // Para retroceder, movemos la carta que está ANTES del final al frente
  // (es un poco más complejo debido al appendChild, pero es la lógica inversa)
  
  // (Implementación básica simplificada para esta demostración)
  const currentCard = cards[currentIndex];
  currentCard.classList.add('swipe-up');
  
  setTimeout(() => {
    currentCard.classList.remove('active', 'swipe-up');
    deck.insertBefore(currentCard, deck.firstChild);
    
    // Actualizar índice
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    cards[currentIndex].classList.add('active');
    
    // Forzar reflow
    deck.offsetHeight;
  }, 400);
});
