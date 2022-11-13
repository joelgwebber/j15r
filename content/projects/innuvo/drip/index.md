+++
title = "Drip"
date = "2005-05-31"
author = ""
cover = ""
tags = [""]
keywords = [""]
description = "This is a description"
summary = "Memory Leak Detection for IE6"
showFullContent = false
+++

When we were working on tools for building complex web apps, I discovered
that Internet Explorer (which held the lion's share of the market at the time)
had terrible problems with memory leaks, because DOM objects were implemented
as C++ COM objects, which used reference counting. While I'm certain I wasn't
the first person to discover it, the problem was not at all well documented.

This was a series of articles I wrote explaining the problem, how to work around
it, and a tool I built to evaluate web apps for memory leaks. Note that while
this is no longer something web developers need to worry about, it's kind of nuts
that this saga went on for well over 5 years before it was finally fixed in IE9.
During that time, web developers trying to build complex apps had to go through
extraordinary contortions to avoid leaking memory, and it significantly distorted
the designs of most early libraries and frameworks.


---
# Jan 2005 • DHTML Leaks Like a Sieve

You heard me: Like a sieve. Gobs and gobs of memory. Necessarily. "Gee, that's
funny", you might say, "My browser doesn't seem to leak noticably". And you're
probably right. However, the design of both major browsers (Internet Explorer
and Mozilla) leaks memory *necessarily* (To be honest, I'm not sure about
Safari and Opera, but it wouldn't surprise me).

Let's take a moment to think about that "necessarily" part.  What I mean by
this is that these browsers are *not* poorly implemented (I'm not going to pass
judgment on that), but rather that their design leads inexorably to memory
leaks. The reason you don't usually see this when browsing is that (a) most
individual pages are simple enough so as not to exhibit the leak and (b) the
few sites that use truly heavy JavaScript often work very hard to get around
these leaks.

If you've ever built a really complex site using lots of JavaScript, you've
probably seen this problem. You may even have some idea of where it comes from.
Well, I'm writing this explanation because (a) I think I fully understand the
problem and (b) there are a lot of confused (or simply wrong) explanations out
there.

## The Joy of Automatic Garbage Collection
The problem is not JavaScript.  Nor is it really the DOM.  It is the
*interface* between the two. JavaScript uses (sometime after Netscape 2.0, I
think) a fully garbage-collected memory allocator. For anyone who doesn't
understand this, this simply means that memory can *never* be truly leaked,
even when objects reference each other circularly (e.g. A-&gt;B-&gt;A). Both
Internet Explorer and Mozilla are built on roughly similar component models for
their native object layer (i.e.  the DOM). Internet Explorer uses the native
windows COM model, while Mozilla uses a very similar XPCOM model. One of the
things these two models have in common is that objects allocated within them
are *not* garbage collected &amp;emdash; they are reference counted.  Again,
for those unfamiliar with the vagaries of memory management systems, this means
that objects might *not* get freed if they take part in a circular reference
(as above).

Now the designers of these browsers have gone to some trouble to keep their COM
layers (I'll refer to both as COM for simplicity) from leaking during normal
usage. If you're careful, this is not too difficult &amp;emdash; you simply
have to be vigilant about potential circular references and use various hacks
to refactor them out of existence. And of course their JavaScript garbage
collectors can't really leak at all.  Where things start to go sour is when you
have circular references that involve both* JavaScript objects and COM objects.
Let me use an example to illustrate this point. Let's say you have a JavaScript
object 'jsComponent' with a reference to an underlying DIV. And the DIV
contains a reference to the jsComponent object. It might look something like
this:

    var someDiv = document.getElementById('someDiv');
    jsComponent.myDomObject = someDiv;
    someDiv.myComponent = jsComponent;

What's wrong with this? What basically appears to happen is that jsComponent
holds a reference to someDiv. In a reference-counted memory manager, this means
that it has a reference count of at least 1, and thus cannot be freed. Now
someDiv also holds a reference to jsComponent (because jsComponent *cannot* be
freed if it is still accessible via someDiv, or things could go *really* bad).
Because COM objects cannot truly participate in garbage collection, they must
create a 'global' reference to myComponent (I'm not sure what the actual
implementation looks like under the hood, because I haven't dug through the
source for either browser, but I imagine it's similar to the semantics of
Java's createGlobalRef() JNI call).  Thus begins the deadly embrace: someDiv's
reference count will stay at 1 as long as jsComponent is not freed, but
jsComponent will not be freed until someDiv drops its global reference to it.
Game over: that memory is irretrievable without human intervention.

At this point, you might be asking yourself how common circular references of
this sort really are. First, I would argue that they *ought* to be relatively
common, because building any sort of reusable component framework in JavaScript
requires this sort of structure to tie the component and DOM layers together.
However, there are many schools of thought on this subject, and if that were
the only problem, it wouldn't be so bad. However, there are two very common
cases that make this problem much more notable.

## Event Handlers
Perhaps the most common manifestation is in DOM event handlers. Most event
handlers take the form " onclick='this.doSomething()' ". This doesn't really
pose a problem. However, if the event handler references a JavaScript object in
any way (as in the aforementioned component scenario), then it serves as a
back-reference. This is why, in many posts and articles I've read about
avoiding memory leaks, the statement "don't forget to unhook all of your event
handlers" is often made.

## Closures
A much more subtle (and therefore nasty) situation where circular references
occur is in JavaScript closures. For those not familiar with the concept, a
closure binds stack variables to an object created in a local scope. You may
well have used them before without realizing it.  For example:

    function foo(buttonElement, buttonComponent) {
      buttonElement.onclick = new function() {
        buttonComponent.wasClicked();
      }
    }

At first glance, it may appear that this method of hooking events on a button
avoids the circular reference problem. After all, the button's 'onclick' event
doesn't directly reference any JavaScript object, and the button element itself
contains no such reference. So how does the event find its way back to the
component? The answer is that JavaScript creates a closure that wraps the
anonymous function and the local variables (in this case, 'buttonElement' and
'buttonComponent'). This allows the code in the anonymous function to call
buttonComponent.wasClicked().

Unfortunately, this closure is an implicitly created object that closes the
circular reference chain containing both the JavaScript button component and
the DOM button element. Thus, the memory leak exists here as well.

## So Now What?
Unfortunately, there really is no easy way around this problem. If you want to
build complex reusable objects in JavaScript, you are probably going to have to
deal with this and some point. And don't feel tempted to think "It's probably
not *that* bad; I'll just ignore it" -- neither Internet Explorer nor Mozilla
free these objects even *after* a page is unloaded, so the browser will just
blow more and more memory.  In fact, I first noticed this problem in my own
work when I saw IE blowing around 150 megabytes of memory!

The only real option I know of is to be extremely careful to clean up potential
circular references. This can be a little tricky if you're writing components
for others to use, because you have to ensure that they call some cleanup
method in the 'onunload' event. But at least by understanding the root cause of
the problem, you have at least some hope of getting your leaks cleaned up
before your users start complaining!

## One Further Note
When I said at the beginning of this article that the design of most web
browsers *necessarily* leaks, I was probably making too strong a statement.
While their reference-counting and mark-and-sweep garbage collection
implementations do not "play well" together, there is *lots* of research on
this subject out there, and I'm sure a way could be found to fix this problem
without throwing away most of the implementation.


---
# May 2005 • Drip: IE Leak Detector


Over the last few months, a number of people have written to me or left
comments asking questions about their memory leak issues with DHTML (or AJAX or
whatever-you-want-to-call-it-this-week) applications.  Unfortunately, there's
not much I could offer in the way of advice that most people don't already
know. Get rid of closures, unhook your event handlers, etc. This advice just
isn't all that helpful when you've got a giant mess of JavaScript (often
inherited) and visually detecting leak scenarios can be maddeningly subtle.

I did, however, find it quite surprising that no one had ever built a leak
detector for Internet Explorer (or apparently for any other browser with leak
problems; Mozilla has some, but they seem to be more for developers working on
Mozilla itself, and the browser does a pretty good job of cleaning up leaks
anyway). So I built one.

## What it Does
It's a pretty simple application. Basically, it lets you open an HTML page (or
pages, in succession) in a dialog box, mess around with it, then check for any
elements that were leaked.

The interface is currently rather spartan.  Here's what the main app looks
like:

[Sorry, I lost the image somewhere along the way]

On the top you'll notice what looks like a crude version of Explorer's
navigation bar. You've got the standard back and forward buttons, the URL box,
and the 'go' button. These behave exactly as you might expect.  To the right of
it, however, is a 'check leaks' button, which will be grayed out when you first
run the app. In order to try it out, you will first need to go to an HTML page
(preferably one that you suspect leaks). The test page at [sorry I lost this
page] will work.  When you load this page, the 'check leaks' button will become
enabled.  Click it to see the following report:

[Yet again, I lost the image somewhere along the way]

This simple page leaks two DOM elements, a DIV and a BUTTON. These two elements
are displayed in the top list, along with their source documents (useful if
you've loaded more than one document between leak tests, or if you have more
than one frame), the number of outstanding references on them, and their ID and
CLASS attributes.

If you click on one, you'll see a list of its enumerable attributes in the
bottom list. A particularly useful attribute for identifying the elements is
'innerHTML'.

## Blowing Memory
Back to the main dialog for a moment. You might also have noticed the
interestingly-titled 'blow memory' button. Its function is simple: to
constantly reload a page as fast as it can, and to report the process' memory
usage in the list box below. This is a helluva lot easier than pressing F5 for
hours to determine how fast a page leaks memory.

## How it Works
Fortunately, Internet Explorer's architecture made this app fairly easy to
build.  It's basically a simple MFC app with a browser COM component in it. The
strategy for catching leaked elements is as follows:

- When a document has been downloaded, sneakily override the document.createElement() function so that the application is notified of all dynamically-created elements.
- When the document is fully loaded, snag a reference to all static HTML elements.
- To detect leaks:  navigate to a blank HTML page (so that IE attempts to release all of the document's elements),
- force a garbage-collection pass (by calling window.CollectGarbage()),
- and look at each element to see if it has any outstanding references (by calling AddRef() and Release() in succession on it).

Within the leak dialog, each element's attributes are discovered and enumerated using the appropriate IDispatch/ITypeInfo methods.

## Caveats
This is basically an alpha release. The interface more or less blows, and I may
have left glaring holes in the leak-detection strategy or in the code itself.
It seems to work for me, but I would really like for anyone using it to keep an
eye out for any problems so that I can fix them. And please don't hesitate to
contact me, of course, if you have any ideas, praise, criticism, or even rants
to offer. I really want this to help people to stop dealing with these
god-awful leaks, and since Microsoft doesn't seem inclined to fix this design
flaw, we can at least try to make it more bearable.

## What Next?
Obviously, I would like any feedback I can get. There are definitely some
interface quirks I need to iron out. And I would like to do more to help
determine the actual *cause* of each leak.  There are a few things that I would
like to find out, and if anyone has any pointers, please share them:

- Can you perform similar tricks with Safari/KHTML or Opera? (I know you can with Mozilla, but since it doesn't really leak much, that seems rather pointless)
- Does anyone know if it's possible to enumerate variables on one of IE's JavaScript closures? (meaning the stack frame hanging off of the function reference)
- How about enumerating expandos on IE DOM objects from C++? (I only seem to get built-in properties from ITypeInfo)

I'm sure other questions will come up in the near future.  Oh, and I *will* be
releasing the source before too long, as soon as I get a few things cleaned up.

Happy leak hunting!

  Update: You can still get to the original [Drip][drip] project page, but it's pretty much useless at this point.

[drip]: http://code.google.com/p/iedrip/


---
# Jun 2005 • Drip Redux

Wow.  Thanks for all the excellent feedback on Drip. It was really just a tool
that I needed for myself, but I'm glad that it may prove useful for others as
well.

There were a lot of comments, both here and on Slashdot, so I'm going to try to
put as many of my thoughts and responses as possible in this post. As such, it
may be a bit of a grab-bag.

## Exacerbating the problem
The first point I want to make is in response to one or two comments here, and
many on Slashdot: That is, that I am not particularly concerned about whether
or not I am exacerbating the problem by helping developers to "work around"
IE's issues.  Don't get me wrong; I find it just as unfortunate as everyone
else that these problems exist in the first place. It is truly awful that
developers using such a high-level tool as a web browser have to take memory
allocation issues into account. Particularly given the fact that they're not
really given the tools to effectively deal with them (window.CollectGarbage()
doesn't count, since it won't really fix the problem).

Anyone who's spent a significant amount of time developing software has to
realize that they will *always* be dealing with inadequacies of their tools and
platforms. This has always been the case. It doesn't mean that vendors
shouldn't fix their mistakes, but it *does* mean that you can't usually bitch
at your customers for their choice of platform. If you are going to make
software development your profession, then you must generally accept this
responsibility.  Certainly there are cases where you can dictate the details of
the client's platform, but this is not the case for most vendors.

I also want to point out two things about this specific problem. First, IE's
memory leak issues stem largely from the underlying model that allows scripting
languages to interface with native COM objects (that is, making all objects
accessible to scripting languages COM objects deriving from IDispatch). While
imperfect, this model is also quite efficient -- and given that it was
developed in the mid-90's, not an unreasonable compromise at the time. The
second point I want to make is that IE is *not* the only browser with this
problem. Mozilla had fairly severe memory leak issues until recently, and I've
been told that Safari does as well. So let's not use this as an excuse to jump
all over Microsoft.

## When do leaks matter?
This is another point that I think bears some discussion. If you've spent a
little time pointing Drip at existing sites, you've probably found that most
sites exhibit no issues at all. This is simply because most sites simply don't
use enough complex DHTML (with complex object graphs and the like) to create
the specific sort of circular references that cause leaks. Most sites that *do*
have a few leaks seem to be of PARAM objects passed to Java and/or Flash
components. I've gotten mixed reports on when this happens, and when it causes
a significant leak, so the jury's still out on whether this matters.

On the other hand, I saw one comment to the effect that Google Maps leaks a
*lot* of elements. This is exactly the sort of application that is in danger of
leaking enough to matter. If you look at the Maps code, you'll discover that
they've done an excellent job of abstracting the components that comprise the
application, and it's quite easy to follow (if you de-obfuscate it, anyway).
And I believe that the fact that it leaks so much is actually an indication
that its developers have done a *good* job.  The problem is that the very
abstractions that make a code base of that size manageable make it *really*
easy to create leaks. Because there are a lot of references among all of its
objects, and most DOM elements are wrapped in one way or another, even a single
leak can cause the entire reference graph to leak. Nasty, huh?

## How do I fix leaks?
This is a pretty complex question. So I've decided to punt this to a
forthcoming post. There are a lot of resources out there on this subject, but I
hope to gather as much of it as possible into one post so that I can provide a
reasonable framework for finding and dealing with them.

## What now?
I've gotten a lot of helpful suggestions and a couple of bug reports. What I
would like to do now is to list all of the fixes and enhancements that I can
think of, and solicit advice on how to prioritize them. Once I've had another
pass at the code, I will release the source as well so that you can all help
maintain it! This is my current list:

- Deal with deeply nested frames. This is a real issue for a lot of sites -- apparently Drip only hooks one level of nested frames, but fails to hook deeper windows.
- Hook the cloneNode() method.  This is simply an oversight on my part, but it's necessary to catch all possible leaks.
- Resizable window. This was just me being lazy. I've gotten really used to constraint-based layout in the Java world, and to be honest, I just didn't want to deal with doing this by hand in MFC.
- Sorted and expandable element properties.  'Nuff said.
- Hook new windows (via window.open).  I think this is feasible, and will do my best.
- Anything else you guys can think of!


---
# Jun 2006 • Drip 0.2

Happy Monday morning to everyone (or, depending upon where you may be,
evening). This is just a quick note to announce Drip 0.2! Here is a quick list
of changes in this version:
- The main window is now resizeable.
- The property list is sorted.
- Property lists are now separate from the leak dialog. You can double-click on an element to see its properties. And you can double-click on any object property to see its properties. Think of it as a poor-man's expandable property list.
- The source is also available here.

My current list of definitely known issues is as follows:
- Still need to hook node.cloneNode() to catch all possible leaks.
- Still need to hook new windows as they are created.
- It sometimes reports that leaks are coming from about:blank rather than their actual source.

And my current list of possible issues is:
- A couple of people have mentioned crashes occuring, which I have not yet been able to reproduce. If anyone having such a problem has a chance to build the source and catch this in a debugger, that would be wonderful.
- I've also heard mention of issues with deeply-nested frames. My demo leak test page should exhibit this issue, but seems to work fine. Again, any help appreciated.

As always, please let me know of any other issues you discover, suggestions,
and (even better) patches. And I haven't forgotten about my promise to provide
a solid overview of how to deal with leak issues. I'm still doing a bit of
research on the subject, but this will be forthcoming soon!


---
# Jun 2006 • Another Word or Two on Memory Leaks

Ok, I promised to explain in more detail how to get rid of memory leaks once
you've found them. Though I haven't had time to gather all of the information
and examples I would have liked, I have run across a few external resources
that might be of help.

The first of these is a new [Microsoft Technical Article][msdn] that discusses
the various forms that IE memory leaks can take in some detail. Particularly
interesting is the fact that it discusses an even more obscure type of leak
that's not even a DOM element. It's definitely worth a read.

A bit more information on JavaScript closures can be found on Eric Lippert's
blog (which I highly recommend) [here][lippert].

For a nice, straightforward library that does an excellent job helping you
avoid the problem altogether, take a look at Mark Wubben's [Event
Cache][novemberborn].  I particularly like the fact that if you follow a simple
set of rules, then you cannot easily leak elements.

## On Another Note
I suggested earlier that the slowdown associated with leaking large amounts of
memory in IE might be associated with hash tables or something similar getting
full and therefore more inefficient. Eric Lippert left the following comment,
which makes perfect sense to me and seems more likely to characterize the
problem:

> The symbol tables are very search-efficient. What's more
likely is that the non-generational mark and sweep garbage collector is getting
more and more full, and therefore taking longer and longer to walk each time a
collection happens. A generational GC, like the .NET framework's GC, solves
this problem by not GCing long-lived networks of objects very often.

And don't worry, I haven't forgotten about Drip at all. As time allows, I will
be adding the features that I mentioned earlier. Of course, if anyone else
wants to play with the [source][ieleak] and make their own additions, please
feel free!

[msdn]: http://msdn.microsoft.com/library/default.asp?url=/library/en-us/IETechCol/dnwebgen/ie_leak_patterns.asp
[lippert]: http://blogs.msdn.com/ericlippert/archive/2003/09/17/53028.aspx
[novemberborn]: http://novemberborn.net/javascript/event-cache
[ieleak]: http://sourceforge.net/projects/ieleak/


---
# Sep 2007 • IE's Memory Leak Fix Greatly Exaggerated

So Microsoft (as reported [here][ie-memory-leaks-be-gone] and
[here][memory-leaks-gone]) recently released a "cumulative security update" for
IE that fixes its egregious memory leaks.  Sounds great.  Even if it takes a
while to get everybody updated, at least the problem is fixed and we can all
stop bending over backwards to work around this problem in our libraries,
right.

## Not So Fast
Let's have a look at the [actual knowledge-base article][kb] to see exactly
what it says:

> "... a Web page that uses JScript scripting code, a memory leak occurs in
Internet Explorer. When you visit a different Web page, the leaked memory is
not released."

So far so good. It even references the original ["circular-reference"
knowledge-base article][kb2], implying that this is indeed what is fixed.

When I saw this article, I nearly spilled tea all over the keyboard. They
really fixed this issue? You mean I can untangle all the painful code in GWT
that works around this issue, diligently cleaning up all its circular DOM
references under all sorts of circumstances?

## Settle Down, Beavis
Before I got too excited, I had to do a little gut-check. Did they really go
back and make it possible for their garbage collector to chase references
through COM objects?  That would be wonderful, but I'm not holding my breath.

And it's a good thing, because there's basically no way in hell they did that.
In fact, it turns out that all they did was write a little code to sweep the
DOM on unload and clean up all the extant circular references on those
elements. This means that *all elements not still attached on unload are still
leaked, along with the transitive closure over all references Javascript
objects*. In even marginally complex applications, that means you're still
going to leak like a bloody sieve!

I put together a [little test script][spew] to show this in action. Have a look
in any version of IE, and watch its spew memory!

## I'm With Alex ...
... [on this one][dojo]. This is more like a bad joke than anything else. I
recognize that fixing IE's memory leaks is a really complex problem, but the
fact that it's not being done is still more evidence that Microsoft is
abandoning IE, at least as far as any real progress is concerned. I just wish
they would come out and say it.

## In the Meantime
Don't go ripping out that memory-leak cleanup code. And keep checking for leaks (perhaps with
[Drip][iedrip]).

[ie-memory-leaks-be-gone]: http://ajaxian.com/archives/ie-memory-leaks-be-gone
[memory-leaks-gone]: http://novemberborn.net/javascript/memory-leaks-gone
[kb]: http://support.microsoft.com/kb/929874/
[kb2]: http://support.microsoft.com/kb/830555/
[spew]: http://j15r.com/example/spew.html
[dojo]: http://alex.dojotoolkit.org/?p=620
[iedrip]: http://code.google.com/p/iedrip/


---
# Jul 2009 • Memory Leaks in IE8

Now that IE8's out, it seems I get to revisit this topic once again, which is
getting quite tedious. When Microsoft first began touting IE8 features, I
noticed a [couple][ms1] of [pages][ms2] pointing out that they had done a great
deal of work to "mitigate" memory leaks in IE. The word "mitigate" sounds a bit
fishy, as the source of the problem is [pretty fundamental][leaks] to the
design of the COM interface that their script engine uses to access the DOM and
other native objects.

As [you may recall][ie7], IE7 contained a rough attempt to solve this problem
by walking the DOM on unload, cleaning up leaks on any elements still there.
This helped somewhat, but left many common leak patterns unresolved (in
particular, any element removed from the DOM could still leak easily).

From my tests, IE8 appears to have resolved all of the most common leak
patterns (as described in the two IE8 links above). In particular, I can't
uncover a single leak that doesn't at least get cleaned up on unload. This is
good news for IE users, because under most circumstances it means that the
browser won't get slow and bloated over time.

### How IE8 leaks
With some cursory testing, however, I have uncovered at least one pattern that
still leaks memory on IE8. Consider the following code (which you can run
[here][spew]):

    // This approach hangs a massive js object from a dynamically created DOM
    // element that is attached to the DOM, then removed. This pattern leaks
    // memory on IE8 (in "IE8 Standards" mode).
    function spew() {
      // Create a new div and hang it on the body.
      var elem = document.createElement('div');
      document.body.appendChild(elem);

      // Hang a *really* big-ass javascript object from it.
      var reallyBigAss = {};
      for (var i = 0; i < 5; ++i) {
        reallyBigAss[i] = createBigAssObject();
      }
      elem.__expando = reallyBigAss;

      // Complete the circular reference.
      // Comment out the following line, & the leaks disappear.
      elem.__expando.__elem = elem;

      // Remove it from the DOM. The element should become garbage as soon as
      // this function returns.
      elem.parentElement.removeChild(elem);

      // Just to give it a fighting chance to collect this garbage.
      CollectGarbage();
    }

    function createBigAssObject() {
      var o = {};
      for (var i = 0; i < 100000; ++i) {
        o[i] = 'blah';
      }
      return o;
    }

This will leak at runtime on IE8. It <em>does</em> get cleaned up when the page
is unloaded, but it can still be a serious problem for long-running pages
(complex Ajax applications, for example).

This particular example is admittedly somewhat contrived, but it is actually
isomorphic to a common use pattern:

- Create an element.
- Attach it to the DOM.
- Create some event handlers that result in circular refs.
- At some point in the future, after the user's done with it, remove it.

Sounds like a popup, a menu bar, or just about any interactive element that
gets created and removed in an application, n'est-ce pas?

### What should I do about it?

Honestly, I would advise that you continue to do whatever you always have done.
Most Java\[script\] libraries (GWT, Dojo, jQuery, Prototype, etc.) already have
code in place to clean up these sorts of leaks, and they will continue to work
as advertised (I've personally checked GWT for leaks on IE8). It is unfortunate
that we have to continue doing these things, because they have a non-trivial
performance cost; and although it's taken a while, WebKit and Gecko seemed to
have finally nailed their own memory leak issues.

### Aside: Drip is dead
I wrote [Drip][drip] some years back in order to help track down memory leaks
on Internet Explorer. I incorrectly assumed that it would be useful for a year
or two, as the problem would eventually be dealt with by Microsoft.

Well, they did finally deal with the problem, primarily by building [their own
memory leak detector][detector]. The good news is that it works quite well, and
is probably much more comprehensive than Drip ever was (and I haven't had much
time to maintain it). The first caveat I would add is that you almost
invariably want to change it to report "actual leaks" -- I don't find the IE6
and IE7 options to be useful in practice. The really bad news is that it
isn't useful on IE8 -- it will install, but doesn't catch any actual leaks, as
far as I can tell.

[ms1]: http://msdn.microsoft.com/en-us/library/dd361842(VS.85).aspx
[ms2]: http://blogs.msdn.com/ie/archive/2008/08/26/ie8-performance.aspx
[leaks]: http://blog.j15r.com/2005/01/dhtml-leaks-like-sieve.html
[drip]: http://blog.j15r.com/2005/05/drip-ie-leak-detector.html
[detector]: http://blogs.msdn.com/gpde/pages/javascript-memory-leak-detector.aspx
[ie7]: http://blog.j15r.com/2007/09/ies-memory-leak-fix-greatly-exaggerated.html
[spew]: http://j15r.com/example/spew.html


---
# Sep 2010 • IE9 Memory Leaks Finally Declared Dead

IE9: Memory Leaks Finally Declared Dead

It is with great pleasure that I can finally declare the [infamous][leaks],
[painful][drip], [long-standing][moreleaks], [never][stillleaks]
[fixed][ie8leaks] IE memory leak bug fixed! With the release of IE9, I have
verified that every leak pattern I'm aware of is fixed. It's been a long-time
coming, but I'm starting to feel more confident that IE9 can be reasonably
called part of the "modern web" -- the web that is sufficiently powerful to
support complex applications, and not just lightly scripted documents.

One caveat: Do be aware that your "standard" pages need to explicitly request
"IE9 Standards" mode, using either an HTTP response header or a meta tag like
the following:

    <meta http-equiv='X-UA-Compatible' content='IE=9'/>

Failure to do so, in addition to giving you all the old crufty bugs and quirks
in previous IE versions, will continue to leak memory, presumably because it is
using the DLLs from the old rendering engine.

Now perhaps I can finally stop writing about this stupid bug!

[leaks]: http://blog.j15r.com/2005/01/dhtml-leaks-like-sieve.html
[drip]: http://blog.j15r.com/2005/05/drip-ie-leak-detector.html
[moreleaks]: http://blog.j15r.com/2005/06/another-word-or-two-on-memory-leaks.html
[stillleaks]: http://blog.j15r.com/2007/09/ies-memory-leak-fix-greatly-exaggerated.html
[ie8leaks]: http://blog.j15r.com/2009/07/memory-leaks-in-ie8.html

