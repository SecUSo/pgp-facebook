# config/autoconf.mk.  Generated from autoconf.mk.in by configure.

CC = gcc
PERL = /usr/bin/perl
PYTHON = /usr/bin/python2
CFLAGS = -g -O2
LDFLAGS = 

OS_TARGET = Linux
CPU_ARCH = x86_64-gcc3

DLL_PREFIX = lib
DLL_SUFFIX = .so

TB_PATH = ""
TB_ARGS = 

TESTS = 
FIX_LANGUAGES = yes
ENABLE_LANG = yes

srcdir = .

DIST = $(DEPTH)/build/dist
BUILD = $(DEPTH)/build

JSUNIT = $(DEPTH)/util/run-jsunit $(PERL) $(TB_PATH) $(TB_ARGS) -jsunit
