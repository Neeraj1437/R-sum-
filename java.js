let menu =document.querySelector('#menu-bars');
let navbar =document.querySelector('.navbar');


// menu bar
menu.onclick = () =>{
    navbar.classList.toggle('active');
}

let section =document.querySelectorAll('section');
let navLinks =document.querySelectorAll('header .navbar a');


window.onscroll = () =>{
    menu.classList.remove('fa-times');
    navbar.classList.remove('active');

    section.forEach(sec=> {

        let top =window.scrollY;
        let height= sec.offsetHeight;
        let offset=sec.offsetTop - 150;
        let id =sec.getAttribute('id');

        if(top >= offset && top < offset + height){
            navLinks.forEach(links => {
                links.classList.remove('active');
                document.querySelector('header .navbar a[href*='+id+']').classList.add('active');

            });

        };

    });
}

// var swiper =new Swiper(" .home-slider",{
//     spaceBetween:30,
//     centeredSlides:true,
//     autoplay: {
//         delay: 7500,
//         disableOnInteraction: false,
//     },
//     pagination: {
//         el:".swiper-pagination",
//         clickable: true,
//     },
//     loop:true,
// })

// review slider
var swiper =new Swiper(" .review-slider",{
    spaceBetween:20,
    centeredSlides:true,
    grabCursor:true,
    autoplay: {
        delay: 7500,
        disableOnInteraction: false,
    },
    loop:true,
    breakpoints:{
        0:{
            slidesPerView: 1,
        },
        640:{
            slidesPerView: 2,
        },
        768:{
            slidesPerView: 2,
        }, 
        1024:{
            slidesPerView: 3,
        },
    }
});


// skills
const skillsContent =document.getElementsByClassName('skills__content'),
      skillsHeader= document.querySelectorAll('.skills__header')

function toggleSkills(){
    let itemClass = this.parentNode.className
    
    for(i=0; i < skillsContent.length; i++){
        skillsContent[i].className ='skills__content skills__close'
    }
    if(itemClass== 'skills__content skills__close'){
        this.parentNode.className = 'skills__content skills__open'
    }

} 

skillsHeader.forEach((el) =>{
    el.addEventListener('click',toggleSkills)

})

