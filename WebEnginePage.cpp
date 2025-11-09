#include "WebEnginePage.h"
#include <QDebug>

WebEnginePage::WebEnginePage(QObject *parent)
    : QWebEnginePage(parent)
{
}

QWebEnginePage *WebEnginePage::createWindow(WebWindowType type)
{
    qDebug() << "Blocked a pop-up window.";
    return nullptr;
}
