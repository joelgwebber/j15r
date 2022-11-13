---
title: "Quake II"
date: "2010-04-01"
author: ""
cover: ""
tags: [""]
keywords: [""]
summary: "Porting Quake II to the Web just for fun"
showFullContent: false
---

In 2010, Ray Cromwell, Stefan Haustein, and I got a wild hair and decided to
cross-compile a Java version Quake II we'd found, to run in the browser. It
ended up being rather a larger undertaking than we'd initially expected, but the
results also worked surprisingly well. This was in the very early days of WebGL,
and Javascript VMs, while much faster than they'd been previously, were still
fairly unpredictable in performance.

The code was derived from an existing Java port called [Jake
2](https://bytonic.de/html/jake2.html), which was itself a very direct
transliteration of the original open-sourced [Quake II C
code](https://github.com/id-Software/Quake-2). The effort to make it compatible
with Web APIs was fairly involved; our original
[presentation](https://www.youtube.com/watch?v=aW--Wlf9EFs) (and
[slides](io2010.pdf)) in 2010 goes into all the gory details, including Stefan's
herculean efforts to make the ancient GL code ES compatible (i.e., eliminating
all the old `glBegin()`/`glEnd()` style imperative API calls).

The game code itself actually runs quite well now, but one thing that still
poses problems is filesystem access. In the original port we went to great
lengths to make all the resource loading async so they could load over
Javascript HTTP APIs.  But we couldn't easily publish the working game that way
because of licensing restrictions around the Quake II demo exe. So later on,
when Stefan was [updating the
code](https://github.com/stefanhaustein/blog/blob/main/WebGL/BlastFromThePast.md)
to work better on modern browsers, he also rewrote file access to simply
download the demo exe from a remote server, and unzip it into the local
Filesystem API, making file access a lot simpler.

Unfortunately, the FileSystem API, while implemented in Chrome, went
unimplemented by other browsers. So it currently only runs on Chrome (Stefan
also wrote an abstraction layer to use IndexedDB, but it still can't work
without some APIs that aren't agreed upon by all browsers). The code is now
getting pretty long in the tooth, so any effort to resolve all of this is likely
beyond the time and energy any of us has to invest in it. But I've put a copy up
on my personal site that works in Chrome, and automatically loads the resources,
so you can just load and play the demo.

Funny tidbit: We did release this intentionally on April 1, as a bit of a meta-
joke. We were all pretty tired of April Fool's jokes, so we thought it would be
fun to release something real but unexpected on that date. Some may recall that
Gmail actually did the same thing in 2004; offering 2G of storage at that time
really did sound like a joke to many!

A few interesting things about the code:
- I believe [Stefan's repo](https://github.com/stefanhaustein/quake2-playn-port)
  is the most up-to-date one out there.
- The network code really _did_ work in ages past. We used to be able to set it
  up so that you could just send a URL to anyone and join them in a Deathmatch
  in seconds. It was really cool, and I'm sad it got lost along the way.
  - It was also binary, manually framed UDP code, with its own retry mechanism.
    Porting that to websockets was a huge pain in the ass.
- The version hosted here was compiled without optimizations enabled, so it
  weighs in at around 2.8M. With optimizations enabled, it should be well under
  a megabyte, roughly in line with the original compiled x86 code. Not bad.

And about the demo:
- It will load in windowed mode, but shift-enter will take you fullscreen.
- It will capture your mouse, but you have to first click to initiate.
- It's really dark. The gamma code got disabled somewhere in the shuffle.
- It caches all resources, so it's only slow to load the first time.
- [Play now!](/q2) (Chrome only -- see above for why)

Below I've also linked my original blog post on the subject, in case it's of
any historical interest:
