---
title: "Quake in HTML5"
date: "2010-04-02"
author: ""
cover: ""
tags: [""]
keywords: [""]
summary: "What does this really mean?"
showFullContent: false
---

# What does this really mean?

Now that we've finally been able to push our [port] of Quake II to the browser
public, it's time to discuss the questions "what's the point?" and "what does
this mean for the future?".

Let me begin with a tweet I saw last night, which neatly summarizes a very
salient point:

> Not sure if the best endorsement of JS engine speed in 2010 is ports of
> games from 1997...
>
> http://twitter.com/tberman/status/11446377136

Well said. We should be setting the bar higher than this. The choice of Quake
II was mainly predicated on the fact that a Java port already existed, and this
was just a 20% project (more like -5%, actually -- nights and weekends for the
most part). I'm pretty certain Quake III would have ported just as easily
(perhaps more easily, as it was written specifically for hardware acceleration
and likely leans on the hardware a little more).

So then there's the fact that it's running at frame rates about a third of what's
possible on the same hardware in C (or [on the JVM][jake2], for that matter).
There are a few reasons for this:

* There are inefficiencies still to be worked out in WebGL implementations,
  especially the expensive frame buffer read-back on Chrome.
* There are things being done in Javascript that really ought to be done in
  vertex shaders; this especially applies to things like model animation
  interpolation, which is a nasty hot spot in the Javascript code that could
  easily be pushed to the shader.
* There are some things, such as dealing with packed binary data structures,
  that are incredibly inefficient in Javascript (and I mean something like
  100x slower than JVM or C code). This can be largely mitigated through
  better APIs, such as the Khronos Group's [Typed Arrays][typedarrays] spec.
* This code is fairly idiosyncratic, having been ported from straight C, and
  exercises some code generation paths in the GWT compiler that could be
  better optimized (using lots of small arrays, and lots of static methods,
  still needs some work).

I would be willing to hazard a guess that we could easily get another 30%
out of the frame rate with relatively minor tweaks. If the game were written
from the ground up to work with web technologies, it would likely be twice as
fast on any reasonable metric (frame rate, startup time, etc.). That's an
extremely rough estimate, but I'd be willing to bet on it.

So back to our original question. What's the point? What this code currently
proves is that it's feasible to build a "real" game on WebGL, including complex
game logic, collision detection, and so forth. It also did an excellent job
exposing weak spots in the current specs and implementations, information we
can and will use to go improve them.

Now if I were starting with a plain C code base, I would most likely prefer to
port it using a technology like [NaCl][nacl] -- that's what it's for. But while
it's not feasible to actually ship games on WebGL yet (it will be a while
before it's widely deployed enough for that), one can envision a world where
game developers can deploy their games as easily as we currently deploy web
pages, and users can play them just as easily. And that's a pretty damned
compelling world to imagine.

[port]: http://code.google.com/p/quake2-gwt-port/
[jake2]: http://bytonic.de/html/benchmarks.html
[typedarrays]: https://cvs.khronos.org/svn/repos/registry/trunk/public/webgl/doc/spec/TypedArray-spec.html
[nacl]: http://code.google.com/p/nativeclient/

