---
title: "Bench2D"
date: "2011-12-15"
author: ""
cover: ""
tags: [""]
keywords: [""]
summary: "Just how fast are these Javascript VMs, anyway?"
showFullContent: false
---

After all that experience porting games to run in the browser, one thing we found to be
consistently true is that VM performance was... inconsistent. While there was no dearth
of Javascript and browser benchmarks available, I thought it would be useful to have one
focused on the specific kinds of code that tend to be a bottleneck in games.

The widely-used Box2D library proved a perfect case for this. These old blog posts explain
the rationale, and over the course of the few years I was maintaining the benchmark, it
showed both significant differences among VMs, and also interesting trends in performance
improvements. I don't believe it would be as useful in today's environment, but it was
quite illuminating at the time.

While it's no longer actively useful, the source (last updated in 2014) can be found
[here](https://github.com/joelgwebber/bench2d).
