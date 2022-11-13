---
title: "Minecraft"
date: "2011-06-01"
author: ""
cover: ""
tags: [""]
keywords: [""]
summary: "Porting Minecraft to the Web for Mojang, but not releasing it"
showFullContent: false
---

On the heels of our success with [Quake II](/projects/quake2) and [Angry
Birds](/projects/angrybirds), we had another opportunity to port a game to
Chrome. This time it was Minecraft! I'm not sure if Chrome DevRel reached out to
Mojang, or Mojang to them, but either way we were given a copy of the Minecraft
Java source, and asked _"think you could get this running in the browser?"_.
Challenge accepted.

This process ended up being fairly similar to the Quake II port. While the
source was entirely Java, it was unsurprisingly written almost entirely to
desktop APIs -- direct filesystem access, raw sockets, old-school
`glBegin()`/`glEnd()` GL code, and so forth. And as with Quake, "single player"
mode involved simply running the server code in-process, with the network layer
stubbed out.

Porting was a painstaking process of isolating all these systems, getting
everything compiling, watching it fail in various ways, fixing things, and
repeating ad infinitum. As before, Stefan did a lot of the heavy lifting on
the graphics code, first abstracting the `glBegin/End()` calls to a layer
that produced WebGL-friendly vertex and element buffers to get it running,
then painstakingly optimizing the abstractions out.

The resource handling wasn't as difficult as Quake, simply because Minecraft
is almost entirely code, with very few file resources. But the in-process
server turned out to be a beast to run in Javascript. We got it working, but
almost immediately realized we needed to keep that part on the server for
decent performance. Fortunately, the network code was fairly straightforward
TCP, so it could be easily ported to websocket frames. Unlike Quake's UDP
nightmare with its own retry mechanisms!

The end result was pretty good. While doubtless less performant than the
"native" Java implementation, it ran in Chrome at well over 60 fps with all
the effects and a reasonably high draw distance. And it was pretty cool to
be able to spin up a world on a server, and have everyone join by just sending
them a link -- no binary install required, no installing texture packs, etc.

{{< figure src="fake-minecraft.png" alt="Fake screenshot of Minecraft in Chrome"
    caption="Pretend this is a real screenshot of Minecraft in Chrome"
>}}

Unfortunately, when it came time to pin down the details of how they might
release a product, our contacts at Mojang seemed to lose interest. There were
some (valid) concerns about maintenance, and some about running mods, which
made less sense to me, as many Minecraft ports couldn't run Java mods. We
never found out much more, and the real issue may have simply been that
they were too busy discussing the upcoming Microsoft acquisition.

But I'm still disappointed that we could never announce or release it
publicly. The code is probably lying around bit-rotting somewhere at Google
now, never to see the light of day. I feel comfortable discussing it at
this point, as it's far in the past now. But I wish we could have at
least demonstrated it publicly.

