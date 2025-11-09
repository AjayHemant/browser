#ifndef REQUESTHANDLER_H
#define REQUESTHANDLER_H

#include <QWebEngineUrlRequestInterceptor>
#include "AdBlocker.h"

class RequestHandler : public QWebEngineUrlRequestInterceptor
{
    Q_OBJECT

public:
    explicit RequestHandler(AdBlocker *adBlocker, QObject *parent = nullptr);
    void interceptRequest(class QWebEngineUrlRequestInfo &info) override;

private:
    AdBlocker *m_adBlocker;
};

#endif // REQUESTHANDLER_H
