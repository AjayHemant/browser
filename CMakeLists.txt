cmake_minimum_required(VERSION 3.5)

project(NextGenBrowser LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt5 COMPONENTS Core Gui Widgets WebEngineWidgets REQUIRED)

add_executable(NextGenBrowser
    main.cpp
    MainWindow.cpp
    MainWindow.h
    AdBlocker.cpp
    AdBlocker.h
    RequestHandler.cpp
    RequestHandler.h
    WebEnginePage.cpp
    WebEnginePage.h
)

target_link_libraries(NextGenBrowser PRIVATE
    Qt5::Core
    Qt5::Gui
    Qt5::Widgets
    Qt5::WebEngineWidgets
)
