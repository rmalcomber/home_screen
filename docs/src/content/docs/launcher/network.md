---
title: Ping, traceroute and DNS
description: Check whether a host answers, see the route to it, and look up its DNS records, from the machine that runs Home Screen.
---

Three network checks, built in. They run on the machine that runs Home Screen, so they tell you what **that** machine sees: useful on a home server, a NAS or a Raspberry Pi, and for checking a service from the place it actually runs.

Nothing runs while you type. Type the command, and press <kbd>Enter</kbd> (or the button) in the panel that opens.

## Ping

`ping example.com` or `ping 192.168.1.1` sends four ICMP echo requests and shows each reply time, the packet loss, and the minimum, average and maximum.

- Ping and traceroute use **IPv4**. A name that has only IPv6 addresses is reported as such.
- Times on Windows are whole milliseconds (that is what the system reports); Linux and macOS show fractions.
- If the system does not allow programs to send ICMP without special rights (a restricted container, for example), the panel says so and shows **TCP connect time** to port 443 or 80 instead. That measures a handshake, not ICMP, and the result is labelled that way.

## Traceroute

`trace example.com` (or `traceroute`, `tracert`) sends probes with a rising time-to-live and lists each router on the way with three timings, up to 20 hops. `*` means a probe got no answer, which is normal for routers that do not reply. It stops when the host answers, and gives up after about a minute.

If no router answers at all, the panel says so and suggests why (a firewall, or a system that does not pass these replies to programs without special rights) instead of showing a table of stars.

## DNS records

`dns example.com` looks up the A records. Add a type, and optionally the resolver to ask:

| Type | Example |
|---|---|
| `dns example.com MX` | Mail servers (shortcut: `mx example.com`) |
| `dns example.com TXT` | Text records such as SPF (`txt example.com`, `txt _dmarc.example.com`) |
| `dns example.com AAAA`, `NS`, `CNAME`, `SOA`, `SRV`, `CAA` | The other common types (`aaaa`, `ns`, `cname`, `soa`, `srv`, `caa` work as shortcuts too) |
| `dns 8.8.8.8` or `ptr 8.8.8.8` | A reverse lookup: the name for an IP address |
| `dns example.com MX @1.1.1.1` | Ask a particular resolver instead of this machine's |

The panel shows the status (`NOERROR`, `NXDOMAIN` and so on), each record with its TTL, the resolver that answered, and a button for every record type, so you can step through them without retyping. Each row has a **Copy** button, and **Copy result** copies the lot as text.

The question goes to the resolvers this machine is set to use (read from Windows' network settings, or `/etc/resolv.conf`). If none can be found it asks `1.1.1.1`, and says so. Names are looked up exactly as typed: write international names in their `xn--` form.

## Also widgets

**Ping**, **Traceroute** and **DNS records** are in the widget gallery under **Web & network**.

## Good to know

- These tools only work when the page is opened via `localhost`, `127.0.0.1` or a name listed in `--allowed-hosts`, like the [curl runner](/launcher/curl/). See [Options](/getting-started/options/).
- At most two checks run at once, and each is limited in count, hops and time. Host names are checked before use, and nothing is started as a separate program.
- **Docker:** ICMP from a container running as a normal user needs Linux's `net.ipv4.ping_group_range` to include the container's group. Current Docker versions set it; where it is not, ping falls back to TCP connect time and traceroute explains that it cannot read the replies. See [Docker](/getting-started/docker/).
- Because these probe from the machine running Home Screen, anyone who can use the page can ask it to probe hosts the machine can reach. Keep the page private (see [Privacy and security](/guides/privacy-and-security/)).
