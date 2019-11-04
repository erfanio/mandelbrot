# Mandelbrot Fractals Explorer
Mandelbrot fractals renderer in [your browser](https://erfanio.github.io/mandelbrot/)!  
This project is a vehicle for me to experiment with new technologies that I have always been curious about. I'm using OpenGL —through Pixi.js— to render the infinitely scrolling plane and web workers to parallelise the fractal generation.  
I'm planning on further optimising fractal generation using WebAssembly.

# About Mandelbrot
I'm not going to waste your time with some rambling explanation that will probably confuse you more that anything.  
I won't explain my algorithm either since it's that same thing [people have been using since the 90s](http://linas.org/art-gallery/escape/escape.html).  
If you aren't familiar with Mandelbrot fractals, just stare in awe at this gif and maybe google it later.
![Zooming into Mandelbrot fractals and revealing layer upon layers of fascinating shapes (courtesy of WikiMedia)](mandelbrot_zoom.gif)

# Build
During development you can use webpack dev server to make your life much easier
```
yarn install && yarn start
```

You can generate a deployment build using `yarn build` and all you need will be in the `build/` directory.
