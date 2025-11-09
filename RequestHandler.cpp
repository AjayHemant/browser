#include "RequestHandler.h"
#include <QWebEngineUrlRequestInfo>
#include <QDebug>

RequestHandler::RequestHandler(AdBlocker *adBlocker, QObject *parent)
    : QWebEngineUrlRequestInterceptor(parent), m_adBlocker(adBlocker)
{
}

void RequestHandler::interceptRequest(QWebEngineUrlRequestInfo &info)
{
    // Ad-blocker
    if (m_adBlocker && m_adBlocker->shouldBlock(info.requestUrl())) {
        info.block(true);
        return;
    }

    // Insecure request blocker
    if (info.requestUrl().scheme() == "http" && info.resourceType() == QWebEngineUrlRequestInfo::ResourceTypeMainFrame) {
        qDebug() << "Blocking insecure navigation to:" << info.requestUrl();
        info.block(true);
    }
}
